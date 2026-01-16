import { CircleCheck, CircleDashed, CircleX, Loader2 } from "lucide-react";
import { cn } from "../utils/cn";
import type { EventStatus } from "../types";

interface StatusBadgeProps {
  status: EventStatus;
  size?: number;
  className?: string;
}

/**
 * Circular status badge with magical animations
 * - Pending: Dashed circle (muted)
 * - Running: Glowing orb with pulse effect
 * - Completed: Green check with pop + flash animation
 * - Failed: Red X
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
          className="text-[var(--chat-text-subtle)] opacity-40"
        />
      )}
      {status === "running" && (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          {/* Outer ping ring */}
          <div
            className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping"
            style={{ animationDuration: '1.5s' }}
          />
          {/* Glowing orb container */}
          <div className="relative rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 p-[2px] animate-pulse-glow">
            <div className="rounded-full bg-white dark:bg-gray-900 flex items-center justify-center" style={{ width: iconSize, height: iconSize }}>
              <Loader2
                size={iconSize - 2}
                strokeWidth={2.5}
                className="text-indigo-500 animate-spin"
              />
            </div>
          </div>
        </div>
      )}
      {status === "completed" && (
        <div className="animate-complete-pop">
          <div className="rounded-full animate-success-flash">
            <CircleCheck
              size={size}
              strokeWidth={2}
              className="text-green-500"
            />
          </div>
        </div>
      )}
      {status === "failed" && (
        <CircleX
          size={size}
          strokeWidth={2}
          className="text-red-500"
        />
      )}
    </div>
  );
}
