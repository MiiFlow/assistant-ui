import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface StreamingTextProps extends HTMLAttributes<HTMLDivElement> {
  /** The content to display */
  content: string;
  /** Whether the text is currently streaming */
  isStreaming?: boolean;
  /** Show a cursor indicator while streaming */
  showCursor?: boolean;
  /** Custom cursor element */
  cursor?: ReactNode;
  /** Children override (takes precedence over content) */
  children?: ReactNode;
}

/**
 * Headless StreamingText primitive.
 * Renders text with streaming indicator support.
 */
export const StreamingText = forwardRef<HTMLDivElement, StreamingTextProps>(
  (
    { content, isStreaming = false, showCursor = true, cursor, children, ...props },
    ref
  ) => {
    const defaultCursor = (
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "2px",
          height: "1em",
          backgroundColor: "currentColor",
          marginLeft: "2px",
          verticalAlign: "text-bottom",
          animation: "blink 1s step-end infinite",
        }}
      />
    );

    return (
      <div ref={ref} data-streaming={isStreaming} {...props}>
        {children ?? content}
        {isStreaming && showCursor && (cursor ?? defaultCursor)}
      </div>
    );
  }
);

StreamingText.displayName = "StreamingText";
