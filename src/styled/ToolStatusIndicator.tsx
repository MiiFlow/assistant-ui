import { cn } from "../utils/cn";

export type ToolStatus = "running" | "complete" | "failed" | "pending";

export interface ToolStatusIndicatorProps {
  /** Name of the tool */
  toolName: string;
  /** Current status */
  status: ToolStatus;
  /** Optional description of what the tool is doing */
  description?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Inline status indicator for individual tool executions.
 * Shows tool name + status icon (spinner/check/X/clock).
 * Running state includes a subtle shimmer animation.
 */
export function ToolStatusIndicator({
  toolName,
  status,
  description,
  className,
}: ToolStatusIndicatorProps) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 py-1 px-2 rounded-md text-sm overflow-hidden",
        status === "running" && "animate-shimmer",
        className,
      )}
    >
      <StatusIcon status={status} />
      <span className="font-medium text-[var(--chat-text)]">{toolName}</span>
      {description && (
        <span className="text-[var(--chat-text-subtle)] truncate">
          {description}
        </span>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ToolStatus }) {
  switch (status) {
    case "running":
      return (
        // Spinner
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-spin text-[var(--chat-primary)]"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      );
    case "complete":
      return (
        // Check circle
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--chat-secondary,#56C18A)]"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "failed":
      return (
        // X circle
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--chat-error,#B1001B)]"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case "pending":
      return (
        // Clock
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--chat-text-subtle)]"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
  }
}
