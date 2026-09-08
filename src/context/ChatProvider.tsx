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
  /** Whether the surface hosting the chat is dark. Drives choices that CSS
   * variables can't express, such as which syntax-highlighting theme a code
   * block uses. The host app must supply this: chat-ui is themed through
   * `--chat-*` variables and the `.dark` class is NOT applied by every
   * consumer, so neither is a reliable signal. Defaults to false (light). */
  isDarkSurface: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * The subset of the chat context a RENDERER needs: how to draw a chip, which
 * code theme to use, what to do when a visualization is acted on.
 *
 * Kept as a separate context because `ChatContextValue` carries `messages`,
 * which changes on every streamed token. A message body that read the chip
 * resolver from there re-rendered on every delta of every OTHER message in
 * the transcript. This value changes only when the host reconfigures the
 * surface, so bodies that read from it stay memoised through a stream.
 */
export interface ChatRenderContextValue {
  viewerRole: ParticipantRole;
  onVisualizationAction?: (event: VisualizationActionEvent) => void;
  resolveCommandToken?: (
    id: string,
    kind: string,
  ) => { label?: string; tag?: ReactNode } | undefined;
  isDarkSurface: boolean;
}

const ChatRenderContext = createContext<ChatRenderContextValue | null>(null);

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
  isDarkSurface?: boolean;
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
  isDarkSurface = false,
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
      isDarkSurface,
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
      isDarkSurface,
    ]
  );

  const renderValue = useMemo<ChatRenderContextValue>(
    () => ({ viewerRole, onVisualizationAction, resolveCommandToken, isDarkSurface }),
    [viewerRole, onVisualizationAction, resolveCommandToken, isDarkSurface]
  );

  return (
    <ChatContext.Provider value={value}>
      <ChatRenderContext.Provider value={renderValue}>{children}</ChatRenderContext.Provider>
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}

export { ChatContext, ChatRenderContext };
