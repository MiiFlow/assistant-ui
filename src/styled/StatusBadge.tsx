import { CircleCheck, CircleDashed, CircleX, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";
import type { EventStatus } from "../types";

interface StatusBadgeProps {
  status: EventStatus;
  size?: number;
  className?: string;
}

/**
 * Circular status badge with animations
 * - Pending: Dashed circle
 * - Running: Animated spinning loader
 * - Completed: Check circle
 * - Failed: X circle
 */
export function StatusBadge({ status, size = 16, className }: StatusBadgeProps) {
  const iconProps = { size, strokeWidth: 2 };

  return (
    <div
      className={cn("relative flex-shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {status === "pending" && (
        <CircleDashed
          {...iconProps}
          className="text-[var(--chat-text-subtle)] opacity-40"
        />
      )}
      {status === "running" && (
        <Loader2
          {...iconProps}
          className="text-[var(--chat-text-subtle)] animate-spin"
        />
      )}
      {status === "completed" && (
        <CircleCheck
          {...iconProps}
          className="text-[var(--chat-text-subtle)]"
        />
      )}
      {status === "failed" && (
        <CircleX
          {...iconProps}
          className="text-red-500"
        />
      )}
    </div>
  );
}
