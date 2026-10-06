import { useContext, useEffect, useState } from "react";
import { ChatRenderContext } from "../context/ChatProvider";
import { usePrefersReducedMotion } from "../hooks/use-reduced-motion";
import type { MediaGeneration } from "../utils/media-generation";

export interface GenerationStatus {
  status: string;
  url?: string;
}
export type ResolveMediaGeneration = (
  jobId: string,
  signal: AbortSignal,
) => Promise<GenerationStatus>;

/** One stable slot while a paid background job runs. Polling only reads our
 * status endpoint; it never calls a generation tool or the provider. */
export function MediaGenerationCard({
  generation,
}: {
  generation: MediaGeneration;
}) {
  const resolve = useContext(ChatRenderContext)?.resolveMediaGeneration;
  const reduced = usePrefersReducedMotion();
  const [snapshot, setSnapshot] = useState<GenerationStatus>();
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  useEffect(() => {
    if (!generation.jobId || !resolve) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let errors = 0;
    let polls = 0;
    setUnavailable(false);
    setSnapshot(undefined);
    setPlaybackFailed(false);
    const poll = async () => {
      try {
        const next = await resolve(generation.jobId!, controller.signal);
        if (controller.signal.aborted) return;
        setSnapshot(next);
        errors = 0;
        if (["completed", "failed", "needs_review"].includes(next.status))
          return;
      } catch {
        if (controller.signal.aborted) return;
        if (++errors >= 3) {
          setUnavailable(true);
          return;
        }
      }
      // Bound a mounted card's polling; a status refresh never regenerates media.
      if (++polls >= 360) {
        setUnavailable(true);
        return;
      }
      timer = setTimeout(poll, errors ? 10000 : 5000);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [generation.jobId, resolve, attempt]);

  const frame = {
    width: "min(100%, 440px)",
    aspectRatio: generation.aspectRatio,
    maxHeight: 440,
  };
  if (snapshot?.status === "completed" && snapshot.url && !playbackFailed) {
    return (
      <div className="my-4 overflow-hidden rounded-2xl" style={frame}>
        <video
          src={snapshot.url}
          controls
          playsInline
          preload="metadata"
          aria-label="Generated video"
          onError={() => setPlaybackFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#111",
          }}
        />
      </div>
    );
  }
  const failed =
    generation.state === "failed" ||
    snapshot?.status === "failed" ||
    snapshot?.status === "needs_review";
  const stopped = generation.state === "stopped";
  const needsRefresh =
    unavailable ||
    playbackFailed ||
    (snapshot?.status === "completed" && !snapshot.url);
  const unsupported = !!generation.jobId && !resolve;
  const working = !failed && !stopped && !needsRefresh && !unsupported;
  const noun = generation.kind;
  const title = unsupported
    ? "Video is processing"
    : needsRefresh
      ? "Preview unavailable"
      : failed
        ? `Couldn't create this ${noun}`
        : stopped
          ? "Generation interrupted"
          : `${generation.editing ? "Editing" : "Creating"} your ${noun}`;
  return (
    <div
      className="relative my-4 overflow-hidden rounded-2xl border"
      style={{
        ...frame,
        borderColor: "var(--chat-border, #ddd)",
        background: "var(--chat-panel-bg, #f3f2f7)",
      }}
    >
      <style>{`@keyframes media-generation-drift { 0%,100% { transform: translate(-8%, -5%) scale(1); opacity: .35; } 50% { transform: translate(8%, 6%) scale(1.15); opacity: .65; } }`}</style>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-25%",
          background:
            "radial-gradient(ellipse at 30% 35%, #a998e7 0%, transparent 50%), radial-gradient(ellipse at 75% 65%, #8cb8d3 0%, transparent 48%)",
          filter: "blur(28px)",
          opacity: 0.35,
          animation:
            working && !reduced
              ? "media-generation-drift 6s ease-in-out infinite"
              : "none",
        }}
      />
      <div
        role="status"
        aria-live="polite"
        aria-busy={working}
        className="relative flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
        style={{ minHeight: 150, color: "var(--chat-text)" }}
      >
        <svg
          aria-hidden="true"
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          className="mb-2 opacity-60"
        >
          {noun === "video" ? (
            <>
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="m10 9 5 3-5 3Z" />
            </>
          ) : (
            <>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8" cy="8" r="1.5" />
              <path d="m3 17 5-5 4 4 4-6 5 7" />
            </>
          )}
        </svg>
        <span className="text-sm font-medium">{title}</span>
        <span className="max-w-64 text-xs opacity-70">
          {unsupported
            ? "Check this generation in your workspace."
            : working
              ? noun === "video"
                ? "This can take a few minutes. Your video will appear here."
                : "Your image will appear here when it’s ready."
              : failed
                ? "The generation could not finish. You can ask to try again."
                : stopped
                  ? "No finished media was received."
                  : "Refresh the preview to check this generation again."}
        </span>
        {needsRefresh && resolve && (
          <button
            type="button"
            className="mt-2 rounded-lg border px-3 py-1.5 text-xs"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Refresh preview
          </button>
        )}
      </div>
    </div>
  );
}
