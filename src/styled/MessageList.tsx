import { forwardRef, type ReactNode } from "react";
import { MessageList as MessageListPrimitive } from "../primitives";
import { cn } from "../utils/cn";

export interface MessageListProps {
  /** Messages to render */
  children: ReactNode;
  /** Whether to auto-scroll to bottom */
  autoScroll?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Styled MessageList with scrolling and spacing.
 */
export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ children, autoScroll = true, className }, ref) => {
    return (
      <MessageListPrimitive
        ref={ref}
        autoScroll={autoScroll}
        className={cn(
          "flex-1 overflow-y-auto",
          "flex flex-col gap-4 p-4",
          "chat-scrollbar",
          className
        )}
      >
        {children}
      </MessageListPrimitive>
    );
  }
);

MessageList.displayName = "MessageList";
