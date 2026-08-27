import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import { ReactNode } from 'react';
import { C as ChatMessage, P as ParticipantRole } from '../message-DTNTKSQr.js';
import { g as VisualizationActionEvent } from '../streaming-BfLEgW5u.js';

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
    /** Resolve how to render an inline command-token chip (e.g. an
     * `@<id>:ad-account` mention). Wire format only carries id + kind, so the
     * host app supplies the display info. Returning `tag` replaces the default
     * uppercase kind pill (e.g. a platform logo). Returning `label` overrides
     * the id text. */
    resolveCommandToken?: (id: string, kind: string) => {
        label?: string;
        tag?: ReactNode;
    } | undefined;
    /** Whether the surface hosting the chat is dark. Drives choices that CSS
     * variables can't express, such as which syntax-highlighting theme a code
     * block uses. The host app must supply this: chat-ui is themed through
     * `--chat-*` variables and the `.dark` class is NOT applied by every
     * consumer, so neither is a reliable signal. Defaults to false (light). */
    isDarkSurface: boolean;
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
    resolveCommandToken?: (id: string, kind: string) => {
        label?: string;
        tag?: ReactNode;
    } | undefined;
    isDarkSurface?: boolean;
}
declare function ChatProvider({ children, messages, isStreaming, streamingMessageId, viewerRole, onSendMessage, onStopStreaming, onRetryLastMessage, customData, onVisualizationAction, resolveCommandToken, isDarkSurface, }: ChatProviderProps): react_jsx_runtime.JSX.Element;
declare function useChatContext(): ChatContextValue;

export { ChatContext, type ChatContextValue, ChatProvider, type ChatProviderProps, useChatContext };
