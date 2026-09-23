export { A as Attachment, C as ChatMessage, M as MessageData, a as MessageError, b as Participant, P as ParticipantRole, R as ReasoningChunk, S as SourceReference, c as SourceTypeConfig, d as SuggestedAction, e as SuggestedActionType } from './message-BTw0HJED.js';
import { S as StreamingChunk, M as MediaChunkData, V as VisualizationChunkData } from './streaming-B1iq46Fk.js';
export { c as ClarificationAnswer, C as ClarificationData, d as ClarificationQuestion, b as StreamChunk, a as StreamingOptions, e as StreamingState } from './streaming-B1iq46Fk.js';
export { B as BrandingData } from './branding-NieTEGQf.js';
export { C as ChatContext, a as ChatContextValue, b as ChatProvider, c as ChatProviderProps, E as ENTITY_HREF_SCHEME, d as EntityReference, e as EntityReferenceInfo, f as EntityResolution, g as EntityResolver, h as EntityText, i as entityHref, p as parseEntityHref, u as useChatContext } from './index-COCzFTp-.js';
export { u as useAttachments, b as useAutoScroll, c as useBrandingCSSVars, d as useMessageComposer, e as useScrollLock, f as useStreaming } from './use-branding-css-vars-6ULQtbF9.js';
export { A as AvatarPrimitive, C as ComposerContext, a as ComposerInput, b as ComposerSubmit, M as MessageComposerPrimitive, c as MessageContentPrimitive, d as MessageContext, e as MessagePrimitive, f as MessageTimestampPrimitive, u as useComposer, g as useMessage } from './avatar-BOdZto37.js';
export { ActionButton, MessageList as MessageListPrimitive, StreamingText as StreamingTextPrimitive, SuggestedActionsContext, SuggestedActions as SuggestedActionsPrimitive, TypingIndicator as TypingIndicatorPrimitive, useSuggestedActions } from './primitives/index.js';
export { A as AttachmentPreview, a as Avatar, C as ChatContainer, b as ChatLayout, M as MarkdownContent, c as Message, d as MessageActionBar, e as MessageComposer, f as MessageList, S as ScrollToBottomButton, g as StreamingText, h as SuggestedActions, T as ToolStatusIndicator, i as TypingIndicator, W as WelcomeScreen } from './WelcomeScreen-C4MrNTak.js';
import { ClassValue } from 'clsx';
import 'react/jsx-runtime';
import 'react';
import './types-Du00UBst.js';

/** Display contract v1. Text is speech, never a prediction of run completion. */
interface TranscriptBlock {
    id: string;
    kind: "text" | "reasoning" | "tool" | "subagent";
    text?: string;
    /** Wire-only append; snapshots always contain full text. */
    textDelta?: string;
    step?: number | string;
    interrupted?: boolean;
    /** Set on completion; ordinary speech remains text. */
    isFinal?: boolean;
    chunk?: StreamingChunk;
    subagentId?: string;
}
interface AgentTranscript {
    version: 1;
    status: "running" | "waiting" | "completed" | "stopped" | "failed";
    blocks: TranscriptBlock[];
}
declare function readTranscript(value: unknown): AgentTranscript | undefined;
/** Copy-on-write keeps block identity stable across unrelated tool updates. */
declare function updateTranscript(current: AgentTranscript | undefined, frame: AgentTranscript): AgentTranscript;

/**
 * Utility function to merge Tailwind CSS classes with proper precedence.
 * Combines clsx for conditional classes with tailwind-merge for conflict resolution.
 *
 * @example
 * cn("px-4 py-2", "px-6") // => "py-2 px-6"
 * cn("text-red-500", isActive && "text-blue-500") // => "text-blue-500" when isActive
 */
declare function cn(...inputs: ClassValue[]): string;

declare function normalizeMedia(value: Record<string, any>): MediaChunkData;
declare function upsertMedia(items: MediaChunkData[], item: MediaChunkData): MediaChunkData[];
declare function toChatMediaProxyUrl(url: string, anonymousId?: string | null): string;
declare function replaceMediaUrls(text: string, medias?: ReadonlyArray<MediaChunkData>): string;
/** Resolve only explicitly referenced media from earlier messages in this transcript.
 * No global cache: another thread/organization can never donate a matching ID.
 */
declare function withReferencedMedia<T extends {
    textContent?: string;
    medias?: MediaChunkData[];
    visualizations?: VisualizationChunkData[];
}>(messages: T[]): T[];

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
 * Given a background color string, return the best contrast text color.
 * Returns "#ffffff" for dark backgrounds and "#1D2033" for light backgrounds.
 * Falls back to "#ffffff" if the color cannot be parsed.
 */
declare function getContrastTextColor(bgColor: string): string;

/**
 * Remove every inline marker from `content`.
 *
 * The render floor for the plain-text branches: a marker that reached the
 * renderer without render data behind it cannot be shown to a reader as a
 * bare `[VIZ:9fc0ad9c…]`. Kept here, beside the parser, so the marker grammar
 * has exactly one definition — the previous caller-local `[MEDIA:…]`-only
 * regex is how `[VIZ:…]` came to leak.
 */
declare function stripInlineMarkers(content: string): string;
type ContentPart = {
    type: "text";
    content: string;
} | {
    type: "viz";
    id: string;
} | {
    type: "media";
    id: string;
} | {
    type: "sa";
    id: string;
};
/**
 * Parse content and split it by inline markers ([VIZ:id], [MEDIA:id], and [SA:id]).
 */
declare function parseContentWithInlineMarkers(content: string, preserveMedia?: boolean): ContentPart[];

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
        /**
         * Accent for in-progress / live indicators in the reasoning panel:
         * running halo, animated caret, header wave, rail-flow gradient, and
         * active-row wash. Falls back to --chat-primary so existing usage is
         * unchanged. Override independently when the brand primary is neutral
         * and would otherwise blend into completed-state visuals.
         */
        readonly activity: "var(--chat-activity, var(--chat-primary, #106997))";
        readonly messageBg: "var(--chat-message-bg, rgba(0, 0, 0, 0.03))";
        readonly userMessageBg: "var(--chat-user-message-bg, var(--chat-primary, #106997))";
        readonly userMessageText: "var(--chat-user-message-text, #ffffff)";
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

export { type AgentTranscript, type ChatTokens, type ContentPart, type TranscriptBlock, chatTokens, cn, formatMessageTime, formatRelativeTime, getContrastTextColor, normalizeMedia, parseContentWithInlineMarkers, readTranscript, replaceMediaUrls, stripInlineMarkers, toChatMediaProxyUrl, updateTranscript, upsertMedia, withReferencedMedia };
