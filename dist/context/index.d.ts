import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import { ReactNode } from 'react';
import { C as ChatMessage, P as ParticipantRole } from '../message-D3U71RE-.js';
import { d as VisualizationActionEvent } from '../streaming-CXHkN_Ul.js';

interface ChatContextValue {
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
declare const ChatContext: react.Context<ChatContextValue | null>;
interface ChatProviderProps {
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
declare function ChatProvider({ children, messages, isStreaming, streamingMessageId, viewerRole, onSendMessage, onStopStreaming, onRetryLastMessage, customData, onVisualizationAction, }: ChatProviderProps): react_jsx_runtime.JSX.Element;
declare function useChatContext(): ChatContextValue;

export { ChatContext, type ChatContextValue, ChatProvider, type ChatProviderProps, useChatContext };
