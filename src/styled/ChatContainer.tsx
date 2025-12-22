import { forwardRef, type ReactNode, type HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface ChatContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Children to render */
  children: ReactNode;
}

/**
 * Styled container for the chat interface.
 * Provides flex layout and base styling.
 */
export const ChatContainer = forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col h-full",
          "bg-white dark:bg-gray-900",
          "font-sans text-chat-text",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ChatContainer.displayName = "ChatContainer";
