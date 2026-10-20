import { CornerDownRight, CornerUpRight, Paperclip, Pencil, Trash2 } from "lucide-react";
import { cn } from "../utils/cn";

/** A message sent while the assistant was still answering, waiting its turn. */
export interface QueuedComposerMessage {
  id: string;
  text: string;
  attachmentCount?: number;
  /** False when the message cannot go back into the composer intact. */
  editable?: boolean;
}

interface QueuedMessagesProps {
  messages: QueuedComposerMessage[];
  onSteer: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string) => void;
  /** A turn is running: the primary action stops it ("Steer"). Otherwise the
   *  queue is held after a Stop and the action just sends ("Send now"). */
  isStreaming: boolean;
  /** Edit replaces the composer's draft, so it waits for an empty one. */
  canEdit: boolean;
}

const iconButton =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--chat-text-subtle)] hover:bg-[var(--chat-panel-bg)] hover:text-[var(--chat-text)] disabled:opacity-40 disabled:pointer-events-none";

/** The list of queued messages shown just above the composer. */
export function QueuedMessages({
  messages,
  onSteer,
  onRemove,
  onEdit,
  isStreaming,
  canEdit,
}: QueuedMessagesProps) {
  if (messages.length === 0) return null;
  return (
    <ul
      aria-label="Queued messages"
      className="mx-3 mb-[-1px] rounded-t-xl border border-b-0 border-[var(--chat-composer-border,rgba(0,0,0,0.1))] bg-[var(--chat-surface,#fff)] px-1.5 py-1"
    >
      {messages.map((message) => (
        <li key={message.id} className="flex min-w-0 items-center gap-2 py-0.5 pl-1.5">
          <CornerDownRight size={14} className="shrink-0 text-[var(--chat-text-subtle)]" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--chat-text)]" title={message.text}>
            {message.text || "Attachment"}
          </span>
          {message.attachmentCount ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 text-xs text-[var(--chat-text-subtle)]"
              aria-label={`${message.attachmentCount} attachment${message.attachmentCount === 1 ? "" : "s"}`}
            >
              <Paperclip size={12} aria-hidden />
              {message.attachmentCount}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onSteer(message.id)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-sm",
              "text-[var(--chat-text-subtle)] hover:bg-[var(--chat-panel-bg)] hover:text-[var(--chat-text)]",
            )}
            title={isStreaming ? "Stop the current answer and send this instead" : "Send this message now"}
          >
            <CornerUpRight size={14} aria-hidden />
            {isStreaming ? "Steer" : "Send now"}
          </button>
          {onEdit && message.editable !== false ? (
            <button
              type="button"
              onClick={() => onEdit(message.id)}
              disabled={!canEdit}
              className={iconButton}
              aria-label="Edit queued message"
              title={canEdit ? "Edit" : "Clear the composer to edit this message"}
            >
              <Pencil size={14} aria-hidden />
            </button>
          ) : onEdit ? (
            // Keeps the action columns aligned across rows.
            <span className="w-7 shrink-0" aria-hidden />
          ) : null}
          <button
            type="button"
            onClick={() => onRemove(message.id)}
            className={iconButton}
            aria-label="Remove queued message"
            title="Remove"
          >
            <Trash2 size={14} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
