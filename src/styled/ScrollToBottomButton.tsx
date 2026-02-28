import { cn } from "../utils/cn";

export interface ScrollToBottomButtonProps {
  /** Whether the viewport is at the bottom (hides button when true) */
  isAtBottom: boolean;
  /** Callback to scroll to bottom */
  onScrollToBottom: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A floating button that appears when the user has scrolled up,
 * allowing them to quickly jump back to the latest messages.
 * Fades in/out based on scroll position.
 */
export function ScrollToBottomButton({
  isAtBottom,
  onScrollToBottom,
  className,
}: ScrollToBottomButtonProps) {
  return (
    <button
      type="button"
      onClick={onScrollToBottom}
      aria-label="Scroll to bottom"
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-10",
        "flex items-center justify-center",
        "w-8 h-8 rounded-full",
        "bg-[var(--chat-bg,#ffffff)] border border-[var(--chat-border)]",
        "shadow-subtle hover:shadow-button-hover",
        "text-[var(--chat-text-subtle)] hover:text-[var(--chat-text)]",
        "transition-all duration-200",
        isAtBottom
          ? "opacity-0 pointer-events-none translate-y-2"
          : "opacity-100 translate-y-0",
        className,
      )}
    >
      {/* ArrowDown icon — inline SVG to avoid lucide-react dependency */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14" />
        <path d="m19 12-7 7-7-7" />
      </svg>
    </button>
  );
}
