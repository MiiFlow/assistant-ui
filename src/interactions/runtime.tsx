import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { z } from "zod";
import type { InteractionActionRequest } from "./action-request";

const httpsUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  });
export const interactionSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  component: z.string(),
  version: z.number(),
  revision: z.number().int().positive(),
  selectionLimit: z.number().int().min(0).max(100),
  title: z.string(),
  data: z.object({
    items: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().optional(),
          url: httpsUrl.optional(),
          image_url: httpsUrl.optional(),
          price: z.string().optional(),
          details: z.record(z.string(), z.string()).optional(),
          latitude: z.number().min(-85).max(85).optional(),
          longitude: z.number().min(-180).max(180).optional(),
        }),
      )
      .min(1)
      .max(100),
  }),
  state: z.object({ selectedIds: z.array(z.string()), comparing: z.boolean() }),
});
export type InteractionSurface = z.infer<typeof interactionSchema>;
export type InteractionItem = InteractionSurface["data"]["items"][number];
export type InteractionRequest = InteractionActionRequest<
  "select" | "compare", { ids: string[] } | Record<string, never>
>;
export interface InteractionTransport {
  load(id: string, signal: AbortSignal): Promise<InteractionSurface>;
  act(
    id: string,
    request: InteractionRequest,
    signal: AbortSignal,
  ): Promise<InteractionSurface>;
}
export class InteractionFailure extends Error {
  constructor(
    message: string,
    public status: number,
    public surface?: InteractionSurface,
  ) {
    super(message);
  }
}
interface Entry {
  surface: InteractionSurface;
  ready: boolean;
  busy: boolean;
  error?: string;
  unavailable?: boolean;
  retry?: InteractionRequest;
}

/** One store per mounted thread. Inline and expanded views subscribe to the same entry. */
export class InteractionRuntime {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private controller = new AbortController();
  constructor(
    readonly threadId: string,
    private transport: InteractionTransport,
  ) {}
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };
  seed(surface: InteractionSurface) {
    if (!this.entries.has(surface.id))
      this.entries.set(surface.id, { surface, ready: false, busy: false });
    return this.entries.get(surface.id)!;
  }
  ingest(surface: InteractionSurface) {
    const entry = this.get(surface.id);
    // A later message/tool read can carry a newer canonical snapshot. Older
    // transcript references must never roll back state already saved here.
    // Accept newer observations even while a request is in flight. Keep the
    // busy/retry lock; an older response cannot overwrite this revision.
    if (surface.revision > entry.surface.revision) {
      this.accept(surface.id, surface);
    }
  }
  get = (id: string) => this.entries.get(id)!;
  private update(id: string, patch: Partial<Entry>) {
    this.entries.set(id, { ...this.get(id), ...patch });
    this.listeners.forEach((notify) => notify());
  }
  private accept(id: string, incoming: InteractionSurface) {
    const surface = interactionSchema.parse(incoming);
    if (surface.id !== id || surface.threadId !== this.threadId)
      throw new Error("Result belongs to another conversation");
    if (surface.revision >= this.get(id).surface.revision)
      this.update(id, { surface });
  }
  async load(id: string) {
    const entry = this.get(id);
    if (entry.busy || entry.ready || entry.surface.threadId !== this.threadId)
      return;
    this.update(id, { busy: true, error: undefined });
    try {
      this.accept(id, await this.transport.load(id, this.controller.signal));
      this.update(id, { ready: true, unavailable: false });
    } catch (error) {
      this.fail(id, error);
    } finally {
      this.update(id, { busy: false });
    }
  }
  async act(
    id: string,
    action: InteractionRequest["action"],
    payload: InteractionRequest["payload"],
  ) {
    const entry = this.get(id);
    if (!entry.ready || entry.busy || entry.unavailable || entry.retry) return;
    await this.send(id, {
      action,
      payload,
      expectedRevision: entry.surface.revision,
      idempotencyKey: crypto.randomUUID(),
    });
  }
  async retry(id: string) {
    const entry = this.get(id);
    if (entry.busy) return;
    if (entry.retry) await this.send(id, entry.retry);
    else {
      this.update(id, { ready: false });
      await this.load(id);
    }
  }
  private async send(id: string, request: InteractionRequest) {
    this.update(id, { busy: true, error: undefined });
    try {
      this.accept(
        id,
        await this.transport.act(id, request, this.controller.signal),
      );
      this.update(id, { retry: undefined });
    } catch (error) {
      if (!(error instanceof InteractionFailure))
        this.update(id, { retry: request });
      this.fail(id, error);
    } finally {
      this.update(id, { busy: false });
    }
  }
  private fail(id: string, error: unknown) {
    if (this.controller.signal.aborted) return;
    if (error instanceof InteractionFailure && error.surface)
      this.accept(id, error.surface);
    this.update(id, {
      error:
        error instanceof InteractionFailure
          ? error.message
          : "Connection interrupted. Retry to confirm your changes.",
      unavailable:
        error instanceof InteractionFailure &&
        [401, 403, 404].includes(error.status),
      ...(error instanceof InteractionFailure ? { retry: undefined } : {}),
    });
  }
  private consumers = 0;
  retain() {
    this.consumers += 1;
  }
  release() {
    this.consumers -= 1;
    queueMicrotask(() => {
      if (!this.consumers) this.controller.abort();
    });
  }
}

const Context = createContext<InteractionRuntime | null>(null);
export function InteractionProvider({
  threadId,
  transport,
  children,
}: {
  threadId: string;
  transport: InteractionTransport;
  children: ReactNode;
}) {
  const runtime = useMemo(
    () => new InteractionRuntime(threadId, transport),
    [threadId, transport],
  );
  useEffect(() => {
    runtime.retain();
    return () => runtime.release();
  }, [runtime]);
  return <Context.Provider value={runtime}>{children}</Context.Provider>;
}
export function useInteraction(surface: InteractionSurface) {
  const runtime = useContext(Context);
  const fallback = useMemo<Entry>(
    () => ({ surface, ready: false, busy: false }),
    [surface],
  );
  const compatible = runtime?.threadId === surface.threadId ? runtime : null;
  compatible?.seed(surface);
  const entry = useSyncExternalStore(
    compatible?.subscribe ?? noSubscribe,
    () => compatible?.get(surface.id) ?? fallback,
    () => fallback,
  );
  useEffect(() => {
    compatible?.ingest(surface);
    void compatible?.load(surface.id);
  }, [compatible, surface]);
  return { ...entry, runtime: compatible };
}
const noSubscribe = () => () => {};
