import { useState, useCallback } from "react";
import { cn } from "../utils/cn";

export interface MessageActionBarProps {
  /** The text content to copy */
  textContent: string;
  /** Optional callback when regenerate is requested */
  onRegenerate?: () => void;
  /** Optional callback when edit is requested */
  onEdit?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Action bar that appears on hover below assistant message bubbles.
 * Currently implements Copy; onRegenerate and onEdit are reserved for future use.
 */
export function MessageActionBar({
  textContent,
  onRegenerate,
  onEdit,
  className,
}: MessageActionBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = textContent;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [textContent]);

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
        className,
      )}
    >
      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy message"}
        className={cn(
          "flex items-center justify-center",
          "w-7 h-7 rounded-md",
          "text-[var(--chat-text-subtle)] hover:text-[var(--chat-text)]",
          "hover:bg-[var(--chat-panel-bg)]",
          "transition-colors duration-150",
        )}
      >
        {copied ? (
          // Check icon
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          // Copy icon
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </button>

      {/* Regenerate button — only shown if callback provided */}
      {onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          aria-label="Regenerate response"
          className={cn(
            "flex items-center justify-center",
            "w-7 h-7 rounded-md",
            "text-[var(--chat-text-subtle)] hover:text-[var(--chat-text)]",
            "hover:bg-[var(--chat-panel-bg)]",
            "transition-colors duration-150",
          )}
        >
          {/* RefreshCw icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      )}

      {/* Edit button — only shown if callback provided */}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit message"
          className={cn(
            "flex items-center justify-center",
            "w-7 h-7 rounded-md",
            "text-[var(--chat-text-subtle)] hover:text-[var(--chat-text)]",
            "hover:bg-[var(--chat-panel-bg)]",
            "transition-colors duration-150",
          )}
        >
          {/* Pencil icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      )}
    </div>
  );
}
