import { CircleCheck, CircleDashed, CircleX, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";
import type { EventStatus } from "../types";

interface StatusBadgeProps {
  status: EventStatus;
  size?: number;
  className?: string;
}

/**
 * Circular status badge driven by the chat-ui design tokens.
 *
 * - Pending: dashed circle (subtle)
 * - Running: solid primary-fill dot with a quietly spinning loader
 * - Completed: secondary-tinted check
 * - Failed: error-tinted X
 *
 * Intentionally restrained — one shape per state, one motion per state.
 * No gradient, no glow ring, no pulse: the parent timeline already
 * conveys flow with the connector line and the optional row beamer.
 */
export function StatusBadge({ status, size = 16, className }: StatusBadgeProps) {
  const iconSize = Math.max(size - 4, 10);

  return (
    <div
      className={cn("relative flex-shrink-0 flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {status === "pending" && (
        <CircleDashed
          size={size}
          strokeWidth={2}
          className="text-[var(--chat-text-subtle)] opacity-60"
        />
      )}
      {status === "running" && (
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: size,
            height: size,
            backgroundColor: "var(--chat-primary)",
          }}
        >
          <Loader2
            size={iconSize - 2}
            strokeWidth={2.5}
            className="text-white animate-spin"
          />
        </div>
      )}
      {status === "completed" && (
        <CircleCheck
          size={size}
          strokeWidth={2}
          style={{ color: "var(--chat-secondary)" }}
        />
      )}
      {status === "failed" && (
        <CircleX
          size={size}
          strokeWidth={2}
          style={{ color: "var(--chat-error)" }}
        />
      )}
    </div>
  );
}
