import { forwardRef } from "react";
import { StreamingText as StreamingTextPrimitive } from "../primitives";
import { MarkdownContent, type MarkdownContentProps } from "./MarkdownContent";
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
  /** Base font size multiplier (passed to MarkdownContent) */
  baselineFontSize?: number;
  /** Props forwarded to MarkdownContent */
  markdownProps?: Partial<MarkdownContentProps>;
}

/**
 * Styled StreamingText that renders content directly as tokens arrive.
 *
 * Text appears instantly (no artificial typewriter delay), matching
 * platform-standard behavior. A blinking cursor is shown during streaming.
 */
export const StreamingText = forwardRef<HTMLDivElement, StreamingTextProps>(
  (
    {
      content,
      isStreaming = false,
      renderMarkdown = true,
      className,
      baselineFontSize,
      markdownProps,
    },
    ref,
  ) => {
    return (
      <StreamingTextPrimitive
        ref={ref}
        content={content}
        isStreaming={isStreaming}
        showCursor={false}
        className={cn("relative", className)}
      >
        {renderMarkdown ? (
          <MarkdownContent
            baselineFontSize={baselineFontSize}
            {...markdownProps}
          >
            {content}
          </MarkdownContent>
        ) : (
          <span className="whitespace-pre-wrap">{content}</span>
        )}
      </StreamingTextPrimitive>
    );
  },
);

StreamingText.displayName = "StreamingText";
