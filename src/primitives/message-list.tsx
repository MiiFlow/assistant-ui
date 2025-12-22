import { forwardRef, type ReactNode, type HTMLAttributes } from "react";
import { useAutoScroll } from "../hooks/use-auto-scroll";

export interface MessageListProps extends HTMLAttributes<HTMLDivElement> {
  /** Messages to render */
  children: ReactNode;
  /** Whether to auto-scroll to bottom on new messages */
  autoScroll?: boolean;
  /** Threshold from bottom to trigger auto-scroll (pixels) */
  scrollThreshold?: number;
}

/**
 * Headless MessageList primitive.
 * Provides a scrollable container with auto-scroll behavior.
 */
export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ children, autoScroll = true, scrollThreshold = 100, ...props }, ref) => {
    const { containerRef, scrollToBottom } = useAutoScroll<HTMLDivElement>({
      enabled: autoScroll,
      threshold: scrollThreshold,
    });

    // Merge refs
    const mergedRef = (node: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <div ref={mergedRef} data-scroll-to-bottom={scrollToBottom} {...props}>
        {children}
      </div>
    );
  }
);

MessageList.displayName = "MessageList";
