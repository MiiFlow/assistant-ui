import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ChatMessage, ParticipantRole } from "../types";

export interface ChatContextValue {
  /** List of messages in the conversation */
  messages: ChatMessage[];
  /** Whether a message is currently being streamed */
  isStreaming: boolean;
  /** ID of the message currently being streamed */
  streamingMessageId: string | null;
  /** The viewer's role (determines message alignment) */
  viewerRole: ParticipantRole;
  /** Send a new message */
  sendMessage: (content: string, attachments?: File[]) => Promise<void>;
  /** Stop the current streaming response */
  stopStreaming?: () => void;
  /** Retry the last failed message */
  retryLastMessage?: () => Promise<void>;
  /** Custom data passed through context */
  customData?: Record<string, unknown>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export interface ChatProviderProps {
  children: ReactNode;
  messages: ChatMessage[];
  isStreaming?: boolean;
  streamingMessageId?: string | null;
  viewerRole?: ParticipantRole;
  onSendMessage: (content: string, attachments?: File[]) => Promise<void>;
  onStopStreaming?: () => void;
  onRetryLastMessage?: () => Promise<void>;
  customData?: Record<string, unknown>;
}

export function ChatProvider({
  children,
  messages,
  isStreaming = false,
  streamingMessageId = null,
  viewerRole = "user",
  onSendMessage,
  onStopStreaming,
  onRetryLastMessage,
  customData,
}: ChatProviderProps) {
  const sendMessage = useCallback(
    async (content: string, attachments?: File[]) => {
      await onSendMessage(content, attachments);
    },
    [onSendMessage]
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      isStreaming,
      streamingMessageId,
      viewerRole,
      sendMessage,
      stopStreaming: onStopStreaming,
      retryLastMessage: onRetryLastMessage,
      customData,
    }),
    [
      messages,
      isStreaming,
      streamingMessageId,
      viewerRole,
      sendMessage,
      onStopStreaming,
      onRetryLastMessage,
      customData,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}

export { ChatContext };
