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
  /** Resolve how to render an inline command-token chip (e.g. an
   * `@<id>:ad-account` mention). Wire format only carries id + kind, so the
   * host app supplies the display info. Returning `tag` replaces the default
   * uppercase kind pill (e.g. a platform logo). Returning `label` overrides
   * the id text. */
  resolveCommandToken?: (
    id: string,
    kind: string,
  ) => { label?: string; tag?: ReactNode } | undefined;
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
  resolveCommandToken?: (
    id: string,
    kind: string,
  ) => { label?: string; tag?: ReactNode } | undefined;
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
  resolveCommandToken,
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
      resolveCommandToken,
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
      resolveCommandToken,
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
