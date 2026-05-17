import { useEffect, useRef } from "react";
import { cn } from "../utils/cn";
import { injectBeamerKeyframes } from "../utils/beamer";
import type { EventStatus } from "../types";
import type { TimelineItemKind } from "./Timeline";

interface StatusBadgeProps {
  status: EventStatus;
  size?: number;
  className?: string;
  /**
   * Semantic kind of the row this badge marks. Each kind has a distinct
   * marker geometry so the rail itself encodes event type at a glance —
   * dot for thoughts (soft/prose), diamond for tool calls (geometric/
   * action), ring for subagents (a dispatched thread). Shape, not just
   * color, carries the categorical distinction.
   */
  kind?: TimelineItemKind;
}

/**
 * Rail-anchored state marker.
 *
 * Shape carries state alongside color: running markers are visibly larger
 * with a strong breathing halo, so a neutral activity color still reads
 * as "in progress." Color comes from `--chat-activity` with a fallback to
 * `--chat-primary`; callers whose primary is neutral can override the
 * activity accent independently via `BrandingData.activityAccentColor`.
 */
export function StatusBadge({ status, size = 20, className, kind }: StatusBadgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    injectBeamerKeyframes(ref.current);
  }, []);

  const haloSize = Math.max(size, 16);
  const isSubagent = kind === "subagent";
  const isTool = kind === "tool";

  return (
    <div
      ref={ref}
      className={cn("relative flex-shrink-0 flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {status === "pending" && (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            border: "1.25px solid var(--chat-text-subtle)",
            opacity: 0.35,
            background: "transparent",
          }}
        />
      )}

      {status === "running" && (
        <>
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: haloSize,
              height: haloSize,
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 55%, transparent), transparent 70%)",
              transform: "translate(-50%, -50%) scale(.55)",
              animation: "mf-halo 1.5s cubic-bezier(.16,1,.3,1) infinite",
              pointerEvents: "none",
            }}
          />
          {isTool ? (
            <span
              aria-hidden
              style={{
                position: "relative",
                width: 5,
                height: 5,
                background: "var(--chat-activity, var(--chat-primary))",
                boxShadow:
                  "0 0 0 1.5px color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 26%, transparent), 0 0 0 2.5px color-mix(in srgb, var(--chat-text) 6%, transparent)",
              }}
            />
          ) : isSubagent ? (
            <span
              aria-hidden
              style={{
                position: "relative",
                width: 8,
                height: 8,
                borderRadius: 1.5,
                background: "var(--chat-activity, var(--chat-primary))",
                boxShadow:
                  "0 0 0 1.5px color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 26%, transparent), 0 0 0 2.5px color-mix(in srgb, var(--chat-text) 6%, transparent)",
              }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                position: "relative",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--chat-activity, var(--chat-primary))",
                boxShadow:
                  "0 0 0 1.5px color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 24%, transparent), 0 0 0 2.5px color-mix(in srgb, var(--chat-text) 6%, transparent)",
              }}
            />
          )}
        </>
      )}

      {status === "completed" &&
        (isSubagent ? (
          // Encapsulated-node mark: a quiet outer frame with a centered
          // filled core. Reads as "thread containing work" — distinct
          // from a hollow checkbox and from the tool's solid pixel.
          <span
            aria-hidden
            style={{
              position: "relative",
              display: "inline-block",
              width: 7,
              height: 7,
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                border: "1.25px solid color-mix(in srgb, var(--chat-text) 32%, transparent)",
                boxSizing: "border-box",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 2,
                height: 2,
                background: "color-mix(in srgb, var(--chat-text) 60%, transparent)",
              }}
            />
          </span>
        ) : isTool ? (
          <span
            aria-hidden
            style={{
              width: 4,
              height: 4,
              background: "color-mix(in srgb, var(--chat-text) 38%, transparent)",
              boxShadow:
                "inset 0 0 0 0.5px color-mix(in srgb, var(--chat-text) 65%, transparent)",
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "color-mix(in srgb, var(--chat-text) 55%, transparent)",
            }}
          />
        ))}

      {status === "failed" && (
        <span
          aria-hidden
          style={{
            position: "relative",
            width: 12,
            height: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--chat-error)",
            fontSize: 12,
            lineHeight: 1,
            fontWeight: 600,
            transform: "translateY(-0.5px)",
          }}
        >
          ×
        </span>
      )}
    </div>
  );
}
