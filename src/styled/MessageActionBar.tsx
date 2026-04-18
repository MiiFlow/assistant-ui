import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";

const FEEDBACK_CATEGORIES = [
  "Incorrect or incomplete",
  "Not what I asked for",
  "Wrong data",
  "Bad recommendation",
  "Tone or style",
  "Other",
] as const;

export interface MessageActionBarProps {
  /** The text content to copy */
  textContent: string;
  /** Optional callback when regenerate is requested */
  onRegenerate?: () => void;
  /** Optional callback when edit is requested */
  onEdit?: () => void;
  /** Report this response as incorrect (fires mistake-recording pipeline). Reason
   *  combines an optional category chip + free-text details, formatted as
   *  "{category}: {details}" | "{category}" | "{details}" | "". */
  onReportIncorrect?: (reason?: string) => void;
  /** Confirm this response was helpful / correct */
  onConfirmCorrect?: () => void;
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
  onReportIncorrect,
  onConfirmCorrect,
  className,
}: MessageActionBarProps) {
  const [copied, setCopied] = useState(false);
  const [feedbackState, setFeedbackState] = useState<"none" | "correct" | "incorrect">("none");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  const handleDismissFeedback = useCallback(() => {
    // Dismissing closes the modal without recording anything.
    setFeedbackOpen(false);
    setSelectedCategory(null);
    setDetails("");
  }, []);

  const handleSubmitFeedback = useCallback(() => {
    if (feedbackState !== "none") return;
    const trimmed = details.trim();
    const reason = selectedCategory && trimmed
      ? `${selectedCategory}: ${trimmed}`
      : selectedCategory || trimmed;
    setFeedbackState("incorrect");
    setFeedbackOpen(false);
    setSelectedCategory(null);
    setDetails("");
    onReportIncorrect?.(reason || undefined);
  }, [feedbackState, selectedCategory, details, onReportIncorrect]);

  // Escape closes the modal (backdrop click handles mouse dismissal).
  useEffect(() => {
    if (!feedbackOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismissFeedback();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [feedbackOpen, handleDismissFeedback]);

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
        "relative flex items-center gap-1",
        feedbackOpen
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
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

      {/* Divider before feedback buttons */}
      {(onConfirmCorrect || onReportIncorrect) && feedbackState === "none" && (
        <div className="w-px h-4 bg-[var(--chat-text-subtle)] opacity-20 mx-0.5" />
      )}

      {/* Thumbs up — confirm correct */}
      {onConfirmCorrect && feedbackState === "none" && (
        <button
          type="button"
          onClick={() => {
            setFeedbackState("correct");
            onConfirmCorrect();
          }}
          aria-label="This response was helpful"
          className={cn(
            "flex items-center justify-center",
            "w-7 h-7 rounded-md",
            "text-[var(--chat-text-subtle)] hover:text-[var(--chat-text)]",
            "hover:bg-[var(--chat-panel-bg)]",
            "transition-colors duration-150",
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
          </svg>
        </button>
      )}

      {/* Thumbs down — report incorrect (opens feedback modal) */}
      {onReportIncorrect && feedbackState === "none" && (
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          aria-label="This response was incorrect"
          aria-haspopup="dialog"
          aria-expanded={feedbackOpen}
          className={cn(
            "flex items-center justify-center",
            "w-7 h-7 rounded-md",
            "text-[var(--chat-text-subtle)] hover:text-[var(--chat-text)]",
            "hover:bg-[var(--chat-panel-bg)]",
            feedbackOpen && "bg-[var(--chat-panel-bg)] text-[var(--chat-text)]",
            "transition-colors duration-150",
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
          </svg>
        </button>
      )}

      {/* Feedback submitted indicator */}
      {feedbackState !== "none" && (
        <span className="text-xs text-[var(--chat-text-subtle)] px-1">
          {feedbackState === "correct" ? "Thanks!" : "Reported"}
        </span>
      )}

      {/* Feedback modal — portaled to document.body with inline styles so it
       *  escapes the widget's shadow DOM / transformed containing block and
       *  renders as a true full-viewport overlay. */}
      {feedbackOpen && typeof document !== "undefined" &&
        createPortal(
          <div
            role="presentation"
            onClick={handleDismissFeedback}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483600,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            }}
          >
            <style>{FEEDBACK_MODAL_CSS}</style>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Share feedback"
              onClick={(e) => e.stopPropagation()}
              className="mf-fbm-card"
            >
              <div className="mf-fbm-header">
                <span className="mf-fbm-title">Share feedback</span>
                <button
                  type="button"
                  onClick={handleDismissFeedback}
                  aria-label="Close feedback"
                  className="mf-fbm-close"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              <div className="mf-fbm-chips">
                {FEEDBACK_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(active ? null : cat)}
                      className={cn("mf-fbm-chip", active && "mf-fbm-chip--active")}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="What went wrong? (optional)"
                rows={3}
                className="mf-fbm-textarea"
              />

              <div className="mf-fbm-actions">
                <button
                  type="button"
                  onClick={handleSubmitFeedback}
                  disabled={!selectedCategory && !details.trim()}
                  className="mf-fbm-submit"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

const FEEDBACK_MODAL_CSS = `
.mf-fbm-card {
  width: 420px;
  max-width: 100%;
  background: #ffffff;
  color: #111827;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  padding: 20px;
  box-sizing: border-box;
}
.mf-fbm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.mf-fbm-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}
.mf-fbm-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
}
.mf-fbm-close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #111827;
}
.mf-fbm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.mf-fbm-chip {
  font-size: 12px;
  line-height: 1;
  padding: 6px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  background: #ffffff;
  color: #111827;
  cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;
}
.mf-fbm-chip:hover {
  background: rgba(0, 0, 0, 0.04);
}
.mf-fbm-chip--active,
.mf-fbm-chip--active:hover {
  background: #111827;
  color: #ffffff;
  border-color: #111827;
}
.mf-fbm-textarea {
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: #111827;
  background: #f9fafb;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 8px;
  padding: 10px 12px;
  resize: none;
  outline: none;
}
.mf-fbm-textarea:focus {
  border-color: #111827;
}
.mf-fbm-textarea::placeholder {
  color: rgba(0, 0, 0, 0.45);
}
.mf-fbm-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
.mf-fbm-submit {
  font-size: 13px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 8px;
  border: none;
  background: #111827;
  color: #ffffff;
  cursor: pointer;
  transition: opacity 120ms;
}
.mf-fbm-submit:hover {
  opacity: 0.9;
}
.mf-fbm-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
`;
