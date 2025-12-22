import {
  createContext,
  useContext,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import type { MessageData, ParticipantRole } from "../types";

interface MessageContextValue {
  message: MessageData;
  isViewer: boolean;
  isStreaming: boolean;
}

const MessageContext = createContext<MessageContextValue | null>(null);

/**
 * Hook to access the current message context.
 * Must be used within a Message component.
 */
export function useMessage() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessage must be used within a Message component");
  }
  return context;
}

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  /** The message data */
  message: MessageData;
  /** The viewer's role (used to determine alignment) */
  viewerRole?: ParticipantRole;
  /** Children to render inside the message */
  children: ReactNode;
}

/**
 * Headless Message primitive.
 * Provides message context to children and data attributes for styling.
 */
export const Message = forwardRef<HTMLDivElement, MessageProps>(
  ({ message, viewerRole = "user", children, ...props }, ref) => {
    const isViewer = message.participant?.role === viewerRole;
    const isStreaming = message.isStreaming ?? false;

    return (
      <MessageContext.Provider value={{ message, isViewer, isStreaming }}>
        <div
          ref={ref}
          data-role={message.participant?.role}
          data-viewer={isViewer}
          data-streaming={isStreaming}
          {...props}
        >
          {children}
        </div>
      </MessageContext.Provider>
    );
  }
);

Message.displayName = "Message";

export interface MessageContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Custom content to render instead of message text */
  children?: ReactNode;
}

/**
 * Renders the message content.
 * By default renders the message's textContent.
 */
export const MessageContent = forwardRef<HTMLDivElement, MessageContentProps>(
  ({ children, ...props }, ref) => {
    const { message } = useMessage();

    return (
      <div ref={ref} {...props}>
        {children ?? message.textContent}
      </div>
    );
  }
);

MessageContent.displayName = "MessageContent";

export interface MessageTimestampProps extends HTMLAttributes<HTMLSpanElement> {
  /** Custom date formatter */
  format?: (date: Date) => string;
}

/**
 * Renders the message timestamp.
 */
export const MessageTimestamp = forwardRef<HTMLSpanElement, MessageTimestampProps>(
  ({ format, ...props }, ref) => {
    const { message } = useMessage();
    const date =
      typeof message.createdAt === "string"
        ? new Date(message.createdAt)
        : message.createdAt;

    const formatted = format
      ? format(date)
      : date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

    return (
      <span ref={ref} {...props}>
        {formatted}
      </span>
    );
  }
);

MessageTimestamp.displayName = "MessageTimestamp";

export { MessageContext };
