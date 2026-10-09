import { AtSign, Paperclip, WandSparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

/**
 * Bottom toolbar row for composers: attach button, an Enter-to-send hint that
 * fades in while the composer is focused (requires `group` on the shell), and
 * a trailing slot for the send/stop button.
 */
export function ComposerToolbar({
  onAttachClick,
  onContextClick,
  onSkillsClick,
  disabled,
  hint = "Enter to send · Shift + Enter for a new line",
  showHint = true,
  endSlot,
  className,
}: {
  /** Renders the "+" attach button when provided. */
  onAttachClick?: () => void;
  onContextClick?: () => void;
  onSkillsClick?: () => void;
  disabled?: boolean;
  /** Keyboard hint shown while focused. Pass showHint={false} to hide. */
  hint?: string;
  showHint?: boolean;
  /** Send / stop button. */
  endSlot?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 min-w-0", className)}>
      {onContextClick && (
        <button
          type="button"
          className="chat-composer-attach"
          title="Add accounts or data tables (@)"
          onClick={onContextClick}
          disabled={disabled}
        >
          <AtSign size={16} aria-hidden="true" />
          <span>Add context</span>
        </button>
      )}
      {onSkillsClick && (
        <button
          type="button"
          className="chat-composer-attach chat-composer-secondary"
          title="Choose a skill or search guidelines (/)"
          aria-label="Skills"
          onClick={onSkillsClick}
          disabled={disabled}
        >
          <WandSparkles size={16} aria-hidden="true" />
          <span>Skills</span>
        </button>
      )}
      {onAttachClick && (
        <button
          type="button"
          title="Attach files"
          aria-label="Attach files"
          onClick={onAttachClick}
          disabled={disabled}
          className="chat-composer-attach chat-composer-secondary"
        >
          <Paperclip size={16} aria-hidden="true" />
          <span>Attach</span>
        </button>
      )}

      <div className="flex-1 min-w-0" />

      {showHint && <span className="chat-composer-hint">{hint}</span>}

      {endSlot}
    </div>
  );
}
