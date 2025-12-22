import { forwardRef } from "react";
import { StreamingText as StreamingTextPrimitive } from "../primitives";
import { MarkdownContent } from "./MarkdownContent";
import { cn } from "../utils/cn";

export interface StreamingTextProps {
  /** The content to display */
  content: string;
  /** Whether the text is currently streaming */
  isStreaming?: boolean;
  /** Whether to render as markdown */
  renderMarkdown?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Styled StreamingText with cursor animation.
 */
export const StreamingText = forwardRef<HTMLDivElement, StreamingTextProps>(
  ({ content, isStreaming = false, renderMarkdown = true, className }, ref) => {
    return (
      <StreamingTextPrimitive
        ref={ref}
        content={content}
        isStreaming={isStreaming}
        showCursor={isStreaming}
        className={cn("relative", className)}
        cursor={
          <span
            className={cn(
              "inline-block w-0.5 h-[1em] ml-0.5",
              "bg-current align-text-bottom",
              "animate-[blink_1s_step-end_infinite]"
            )}
          />
        }
      >
        {renderMarkdown ? (
          <MarkdownContent>{content}</MarkdownContent>
        ) : (
          <span className="whitespace-pre-wrap">{content}</span>
        )}
      </StreamingTextPrimitive>
    );
  }
);

StreamingText.displayName = "StreamingText";
