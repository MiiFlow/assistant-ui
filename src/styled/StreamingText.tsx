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
 * @deprecated `Message` no longer uses this: swapping it for the plain
 * renderer at completion remounted the whole answer. Render
 * `<MarkdownContent isStreaming>` instead, which is what this now wraps.
 * Kept for hosts that import it directly; removed in the next major.
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
            isStreaming={isStreaming}
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
