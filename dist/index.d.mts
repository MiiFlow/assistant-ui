export { A as Attachment, C as ChatMessage, M as MessageData, a as Participant, P as ParticipantRole, R as ReasoningChunk, S as SuggestedAction, b as SuggestedActionType } from './message-i2e9SPSw.mjs';
export { b as StreamChunk, c as StreamingOptions, a as StreamingState } from './streaming-DsSwtonH.mjs';
export { B as BrandingData } from './branding-SzYU4ncD.mjs';
export { g as AttachmentPreview, A as Avatar, C as ChatContainer, f as MarkdownContent, b as Message, c as MessageComposer, M as MessageList, S as SourceReference, a as SourceTypeConfig, e as StreamingText, d as SuggestedActions, T as TypingIndicator } from './TypingIndicator-DsTTCkZF.mjs';
export { ChatContext, ChatContextValue, ChatProvider, ChatProviderProps, useChatContext } from './context/index.mjs';
export { useAttachments, useAutoScroll, useBrandingCSSVars, useMessageComposer, useStreaming } from './hooks/index.mjs';
export { A as AvatarPrimitive, f as ComposerContext, C as ComposerInput, e as ComposerSubmit, d as MessageComposerPrimitive, a as MessageContentPrimitive, c as MessageContext, M as MessagePrimitive, b as MessageTimestampPrimitive, g as useComposer, u as useMessage } from './avatar-BZQXxKxo.mjs';
export { ActionButton, MessageList as MessageListPrimitive, StreamingText as StreamingTextPrimitive, SuggestedActionsContext, SuggestedActions as SuggestedActionsPrimitive, TypingIndicator as TypingIndicatorPrimitive, useSuggestedActions } from './primitives/index.mjs';
import { ClassValue } from 'clsx';
import 'react';
import 'react/jsx-runtime';

/**
 * Utility function to merge Tailwind CSS classes with proper precedence.
 * Combines clsx for conditional classes with tailwind-merge for conflict resolution.
 *
 * @example
 * cn("px-4 py-2", "px-6") // => "py-2 px-6"
 * cn("text-red-500", isActive && "text-blue-500") // => "text-blue-500" when isActive
 */
declare function cn(...inputs: ClassValue[]): string;

/**
 * Format a date for display in chat messages.
 */
/**
 * Format a timestamp for display.
 * - Today: "2:30 PM"
 * - This year: "Dec 15, 2:30 PM"
 * - Other years: "Dec 15, 2024, 2:30 PM"
 */
declare function formatMessageTime(date: Date | string): string;
/**
 * Format a relative time (e.g., "2 minutes ago").
 */
declare function formatRelativeTime(date: Date | string): string;

/**
 * Design tokens for the chat UI.
 * These map to CSS custom properties for easy theming.
 */
declare const chatTokens: {
    readonly spacing: {
        /** Vertical spacing between messages (16px) */
        readonly messageBetween: "1rem";
        /** Message bubble horizontal padding (14px) */
        readonly messagePx: "0.875rem";
        /** Message bubble vertical padding (10px) */
        readonly messagePy: "0.625rem";
        /** Container padding (16px) */
        readonly container: "1rem";
        /** Composer padding (16px) */
        readonly composerPadding: "1rem";
    };
    readonly typography: {
        readonly message: {
            readonly fontSize: "1rem";
            readonly lineHeight: 1.5;
            readonly letterSpacing: "0px";
        };
        readonly caption: {
            readonly fontSize: "0.875rem";
            readonly lineHeight: 1.4;
        };
        readonly small: {
            readonly fontSize: "0.8125rem";
            readonly lineHeight: 1.3;
        };
    };
    readonly borderRadius: {
        readonly message: "0.5rem";
        readonly input: "1rem";
        readonly panel: "0.5rem";
        readonly button: "0.5rem";
        readonly chip: "0.25rem";
    };
    readonly colors: {
        readonly primary: "var(--chat-primary, #106997)";
        readonly secondary: "var(--chat-secondary, #56C18A)";
        readonly error: "var(--chat-error, #B1001B)";
        readonly warning: "var(--chat-warning, #DD9652)";
        readonly messageBg: "var(--chat-message-bg, rgba(0, 0, 0, 0.03))";
        readonly userMessageBg: "var(--chat-user-message-bg, var(--chat-primary, #106997))";
        readonly panelBg: "var(--chat-panel-bg, rgba(0, 0, 0, 0.02))";
        readonly panelBorder: "var(--chat-panel-border, rgba(0, 0, 0, 0.06))";
        readonly border: "var(--chat-border, rgba(0, 0, 0, 0.06))";
        readonly borderHover: "var(--chat-border-hover, rgba(0, 0, 0, 0.12))";
        readonly text: "var(--chat-text, #1D2033)";
        readonly subtle: "var(--chat-text-subtle, rgba(0, 0, 0, 0.5))";
        readonly placeholder: "var(--chat-placeholder, rgba(0, 0, 0, 0.4))";
        readonly status: {
            readonly pending: {
                readonly main: "rgba(0, 0, 0, 0.3)";
                readonly bg: "rgba(0, 0, 0, 0.05)";
            };
            readonly running: {
                readonly main: "rgb(99, 102, 241)";
                readonly bg: "rgba(99, 102, 241, 0.08)";
            };
            readonly completed: {
                readonly main: "rgb(16, 185, 129)";
                readonly bg: "rgba(16, 185, 129, 0.08)";
            };
            readonly failed: {
                readonly main: "rgb(239, 68, 68)";
                readonly bg: "rgba(239, 68, 68, 0.08)";
            };
        };
    };
    readonly shadows: {
        readonly subtle: "0 1px 2px rgba(0, 0, 0, 0.04)";
        readonly input: "0 2px 8px rgba(0, 0, 0, 0.08)";
        readonly inputFocus: "0 4px 16px rgba(0, 0, 0, 0.12)";
        readonly button: "0 1px 3px rgba(0, 0, 0, 0.08)";
        readonly buttonHover: "0 2px 6px rgba(0, 0, 0, 0.12)";
        readonly primary: "0 2px 6px rgba(16, 105, 151, 0.3)";
        readonly primaryHover: "0 4px 12px rgba(16, 105, 151, 0.4)";
    };
    readonly animations: {
        readonly messageEntrance: {
            readonly initial: {
                readonly opacity: 0;
                readonly y: 8;
            };
            readonly animate: {
                readonly opacity: 1;
                readonly y: 0;
            };
            readonly transition: {
                readonly duration: 0.3;
                readonly ease: readonly [0.4, 0, 0.2, 1];
            };
        };
        readonly fadeIn: {
            readonly initial: {
                readonly opacity: 0;
            };
            readonly animate: {
                readonly opacity: 1;
            };
            readonly transition: {
                readonly duration: 0.2;
            };
        };
    };
};
type ChatTokens = typeof chatTokens;

export { type ChatTokens, chatTokens, cn, formatMessageTime, formatRelativeTime };
