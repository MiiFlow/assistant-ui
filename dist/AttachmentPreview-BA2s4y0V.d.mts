import * as react from 'react';
import { HTMLAttributes, ReactNode } from 'react';
import { M as MessageData, P as ParticipantRole, S as SuggestedAction, A as Attachment } from './message-DCsGigy0.mjs';
import { S as StreamingChunk } from './streaming-Dsbi9aRq.mjs';
import { h as AvatarProps$1 } from './avatar-m-_wlqIZ.mjs';
import * as react_jsx_runtime from 'react/jsx-runtime';

interface ChatContainerProps extends HTMLAttributes<HTMLDivElement> {
    /** Children to render */
    children: ReactNode;
}
/**
 * Styled container for the chat interface.
 * Provides flex layout and base styling.
 */
declare const ChatContainer: react.ForwardRefExoticComponent<ChatContainerProps & react.RefAttributes<HTMLDivElement>>;

interface MessageListProps {
    /** Messages to render */
    children: ReactNode;
    /** Whether to auto-scroll to bottom */
    autoScroll?: boolean;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Styled MessageList with scrolling and spacing.
 */
declare const MessageList: react.ForwardRefExoticComponent<MessageListProps & react.RefAttributes<HTMLDivElement>>;

interface MessageProps {
    /** The message data */
    message: MessageData;
    /** The viewer's role (determines alignment) */
    viewerRole?: ParticipantRole;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show avatar */
    showAvatar?: boolean;
    /** Whether to show timestamp */
    showTimestamp?: boolean;
    /** Whether to render content as markdown */
    renderMarkdown?: boolean;
    /** Streaming chunks for reasoning panel */
    reasoning?: StreamingChunk[];
    /** Suggested actions */
    suggestedActions?: SuggestedAction[];
    /** Callback when suggested action is selected */
    onSuggestedAction?: (action: SuggestedAction) => void;
    /** Whether reasoning panel is expanded */
    reasoningExpanded?: boolean;
    /** Callback when reasoning panel expansion changes */
    onReasoningExpandedChange?: (expanded: boolean) => void;
}
/**
 * Styled Message component with grid layout matching the main app.
 * Uses grid to align avatar and content, with reasoning above content.
 */
declare const Message: react.ForwardRefExoticComponent<MessageProps & react.RefAttributes<HTMLDivElement>>;

interface MessageComposerProps {
    /** Callback when message is submitted */
    onSubmit: (content: string, attachments?: File[]) => Promise<void>;
    /** Whether the composer is disabled */
    disabled?: boolean;
    /** Placeholder text */
    placeholder?: string;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Styled MessageComposer with input and send button.
 */
declare const MessageComposer: react.ForwardRefExoticComponent<MessageComposerProps & react.RefAttributes<HTMLFormElement>>;

interface AvatarProps extends Omit<AvatarProps$1, "fallback"> {
    /** Size variant */
    size?: "sm" | "md" | "lg";
}
/**
 * Styled Avatar component with role-based icons.
 */
declare const Avatar: react.ForwardRefExoticComponent<AvatarProps & react.RefAttributes<HTMLDivElement>>;

interface TypingIndicatorProps {
    /** Additional CSS classes */
    className?: string;
}
/**
 * Styled TypingIndicator with animated dots.
 */
declare const TypingIndicator: react.ForwardRefExoticComponent<TypingIndicatorProps & react.RefAttributes<HTMLDivElement>>;

interface SuggestedActionsProps {
    /** List of suggested actions */
    actions: SuggestedAction[];
    /** Callback when an action is selected */
    onSelect?: (action: SuggestedAction) => void;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Styled SuggestedActions with chip-style buttons.
 */
declare const SuggestedActions: react.ForwardRefExoticComponent<SuggestedActionsProps & react.RefAttributes<HTMLDivElement>>;

interface StreamingTextProps {
    /** The content to display */
    content: string;
    /** Whether the text is currently streaming */
    isStreaming?: boolean;
    /** Whether to render as markdown */
    renderMarkdown?: boolean;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Styled StreamingText with cursor animation.
 */
declare const StreamingText: react.ForwardRefExoticComponent<StreamingTextProps & react.RefAttributes<HTMLDivElement>>;

interface MarkdownContentProps {
    /** Markdown content to render */
    children: string;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Styled markdown renderer using react-markdown with Tailwind classes.
 */
declare function MarkdownContent({ children, className }: MarkdownContentProps): react_jsx_runtime.JSX.Element;

interface AttachmentPreviewProps {
    /** The attachment to preview */
    attachment: Attachment;
    /** Callback when remove button is clicked */
    onRemove?: () => void;
    /** Whether removal is allowed */
    removable?: boolean;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Styled attachment preview card.
 */
declare const AttachmentPreview: react.ForwardRefExoticComponent<AttachmentPreviewProps & react.RefAttributes<HTMLDivElement>>;

export { Avatar as A, ChatContainer as C, MessageList as M, SuggestedActions as S, TypingIndicator as T, Message as a, MessageComposer as b, StreamingText as c, MarkdownContent as d, AttachmentPreview as e, type ChatContainerProps as f, type MessageListProps as g, type MessageProps as h, type MessageComposerProps as i, type AvatarProps as j, type TypingIndicatorProps as k, type SuggestedActionsProps as l, type StreamingTextProps as m, type MarkdownContentProps as n, type AttachmentPreviewProps as o };
