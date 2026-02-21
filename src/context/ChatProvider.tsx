import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ChatMessage, ParticipantRole, VisualizationActionEvent } from "../types";

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
  /** Callback when user interacts with a visualization (form submit, card action, etc.) */
  onVisualizationAction?: (event: VisualizationActionEvent) => void;
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
  onVisualizationAction?: (event: VisualizationActionEvent) => void;
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
  onVisualizationAction,
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
      onVisualizationAction,
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
      onVisualizationAction,
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
