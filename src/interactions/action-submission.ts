import type {
  InteractionActionOutcome,
  InteractionActionRequest,
} from "./action-request";

type Request = InteractionActionRequest<string, unknown, unknown>;
type State = {
  busy: boolean;
  accepted: boolean;
  uncertain: boolean;
  reason?: string;
};

/** One target's acceptance lifecycle, shared by the continuation adapters. */
export class ActionSubmission<R extends Request> {
  private state: State = { busy: false, accepted: false, uncertain: false };
  private pending?: R;
  private listeners = new Set<() => void>();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(state: State) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  async submit(
    draft: Omit<R, "idempotencyKey">,
    dispatch: (request: R) => Promise<InteractionActionOutcome>,
  ): Promise<InteractionActionOutcome> {
    if (this.state.busy || this.state.accepted)
      return { accepted: false, reason: "already_submitting" };
    const previouslyUncertain = this.state.uncertain;
    // Freeze the user's decision across an uncertain response, even if the
    // caller's mutable inputs change. Retrying is confirmation of THIS action.
    const request =
      this.pending ??
      (JSON.parse(
        JSON.stringify({ ...draft, idempotencyKey: crypto.randomUUID() }),
      ) as R);
    this.pending = request;
    this.update({ busy: true, accepted: false, uncertain: false });
    let outcome: InteractionActionOutcome;
    try {
      outcome = await dispatch(request);
    } catch {
      outcome = { accepted: false, uncertain: true, reason: "network_error" };
    }
    // A later auth/billing refusal says nothing about whether the original
    // uncertain request committed. Keep its key until acceptance or until the
    // host retires this target as stale.
    outcome = {
      ...outcome,
      uncertain:
        !outcome.accepted && (previouslyUncertain || !!outcome.uncertain),
    };
    if (!outcome.uncertain || outcome.accepted) this.pending = undefined;
    this.update({
      busy: false,
      accepted: outcome.accepted,
      uncertain: !!outcome.uncertain && !outcome.accepted,
      reason: outcome.reason,
    });
    return outcome;
  }
}
