import { forwardRef } from "react";
import {
  Message as MessagePrimitive,
  MessageContent as MessageContentPrimitive,
} from "../primitives";
import { Avatar } from "./Avatar";
import { MarkdownContent } from "./MarkdownContent";
import { LoadingDots } from "./LoadingDots";
import { ReasoningPanel } from "./ReasoningPanel";
import { SuggestedActions } from "./SuggestedActions";
import { cn } from "../utils/cn";
import type { MessageData, ParticipantRole, StreamingChunk, SuggestedAction } from "../types";

export interface MessageProps {
  /** The message data */
  message: MessageData;
  /** The viewer's role (determines alignment) */
  viewerRole?: ParticipantRole;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show avatar */
  showAvatar?: boolean;
  /** Whether to show timestamp */
  showTimestamp?: boolean;
  /** Whether to render content as markdown */
  renderMarkdown?: boolean;
  /** Streaming chunks for reasoning panel */
  reasoning?: StreamingChunk[];
  /** Suggested actions */
  suggestedActions?: SuggestedAction[];
  /** Callback when suggested action is selected */
  onSuggestedAction?: (action: SuggestedAction) => void;
  /** Whether reasoning panel is expanded */
  reasoningExpanded?: boolean;
  /** Callback when reasoning panel expansion changes */
  onReasoningExpandedChange?: (expanded: boolean) => void;
}

/**
 * Styled Message component with grid layout matching the main app.
 * Uses grid to align avatar and content, with reasoning above content.
 */
export const Message = forwardRef<HTMLDivElement, MessageProps>(
  (
    {
      message,
      viewerRole = "user",
      className,
      showAvatar = true,
      showTimestamp = true,
      renderMarkdown = true,
      reasoning,
      suggestedActions,
      onSuggestedAction,
      reasoningExpanded,
      onReasoningExpandedChange,
    },
    ref
  ) => {
    const isViewer = message.participant?.role === viewerRole;
    const isAssistant = message.participant?.role === "assistant";
    const isStreaming = message.isStreaming;

    // Filter reasoning chunks for display
    const reasoningChunks = reasoning?.filter(
      (c) =>
        c.type === "thinking" ||
        c.type === "tool" ||
        c.type === "observation" ||
        c.type === "planning" ||
        c.type === "subtask"
    );
    const hasReasoning = reasoningChunks && reasoningChunks.length > 0;

    // Check if waiting for content
    const isWaitingForContent = isStreaming && !message.textContent && !hasReasoning;

    return (
      <MessagePrimitive
        ref={ref}
        message={message}
        viewerRole={viewerRole}
        className={cn("w-full animate-fade-in", className)}
      >
        <div
          className="grid items-start gap-x-2 gap-y-1"
          style={{
            gridTemplateColumns: isViewer ? "1fr auto" : "auto 1fr",
          }}
        >
          {/* Loading indicator when waiting */}
          {isWaitingForContent && (
            <div
              className={cn(
                "max-w-[80%]",
                isViewer ? "col-start-1 justify-self-end" : "col-start-2 justify-self-start"
              )}
            >
              <div
                className={cn(
                  "px-4 py-3 rounded-lg",
                  "bg-[var(--chat-message-bg)] border border-[var(--chat-border)]"
                )}
              >
                <LoadingDots size="small" />
              </div>
            </div>
          )}

          {/* Reasoning Panel - before content for assistant */}
          {hasReasoning && isAssistant && (
            <div
              className={cn(
                "max-w-[80%]",
                isViewer ? "col-start-1 justify-self-end" : "col-start-2 justify-self-start"
              )}
            >
              <ReasoningPanel
                isStreaming={isStreaming}
                chunks={reasoningChunks}
                expanded={reasoningExpanded}
                onExpandedChange={onReasoningExpandedChange}
              />
            </div>
          )}

          {/* Avatar - shown for non-viewer messages */}
          {showAvatar && !isViewer && message.textContent && (
            <div
              className={cn(
                isViewer ? "col-start-2" : "col-start-1",
                hasReasoning ? "row-start-auto" : "row-start-1"
              )}
            >
              <Avatar
                name={message.participant?.name}
                src={message.participant?.avatarUrl}
                role={message.participant?.role}
                className="w-10 h-10 flex-shrink-0"
              />
            </div>
          )}

          {/* Avatar when only reasoning/loading (no content yet) */}
          {showAvatar && !isViewer && !message.textContent && (hasReasoning || isWaitingForContent) && (
            <div
              className={cn(
                isViewer ? "col-start-2" : "col-start-1",
                "row-start-1"
              )}
            >
              <Avatar
                name={message.participant?.name}
                src={message.participant?.avatarUrl}
                role={message.participant?.role}
                className="w-10 h-10 flex-shrink-0"
              />
            </div>
          )}

          {/* Message bubble */}
          {message.textContent && (
            <div
              className={cn(
                "max-w-[85%]",
                isViewer ? "col-start-1 justify-self-end" : "col-start-2 justify-self-start"
              )}
            >
              <div
                className={cn(
                  "px-3.5 py-2.5 rounded-lg",
                  "border border-[var(--chat-border)]",
                  isViewer
                    ? "bg-[var(--chat-user-message-bg)] text-white"
                    : "bg-[var(--chat-message-bg)] text-[var(--chat-text)]",
                  isStreaming && "animate-pulse-subtle"
                )}
              >
                <MessageContentPrimitive>
                  {renderMarkdown ? (
                    <MarkdownContent className={isViewer ? "prose-invert" : ""}>
                      {message.textContent}
                    </MarkdownContent>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.textContent}</p>
                  )}
                </MessageContentPrimitive>

                {/* Timestamp */}
                {showTimestamp && !isStreaming && message.createdAt && (
                  <MessageTimestamp
                    createdAt={typeof message.createdAt === 'string' ? message.createdAt : message.createdAt.toISOString()}
                    isViewer={isViewer}
                  />
                )}
              </div>
            </div>
          )}

          {/* Suggested actions */}
          {suggestedActions && suggestedActions.length > 0 && !isStreaming && (
            <div
              className={cn(
                "max-w-[80%]",
                isViewer ? "col-start-1 justify-self-end" : "col-start-2 justify-self-start"
              )}
            >
              <SuggestedActions
                actions={suggestedActions}
                onSelect={onSuggestedAction}
              />
            </div>
          )}
        </div>
      </MessagePrimitive>
    );
  }
);

Message.displayName = "Message";

function MessageTimestamp({
  createdAt,
  isViewer,
}: {
  createdAt: string;
  isViewer: boolean;
}) {
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <span
      className={cn(
        "text-xs mt-1 block",
        isViewer ? "text-white/60" : "text-[var(--chat-text-subtle)]"
      )}
    >
      {formatTime(createdAt)}
    </span>
  );
}

export { useMessage } from "../primitives";
