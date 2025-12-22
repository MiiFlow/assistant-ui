import * as react from 'react';
import { HTMLAttributes, ReactNode, TextareaHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { M as MessageData, P as ParticipantRole } from './message-DCsGigy0.mjs';

interface MessageContextValue {
    message: MessageData;
    isViewer: boolean;
    isStreaming: boolean;
}
declare const MessageContext: react.Context<MessageContextValue | null>;
/**
 * Hook to access the current message context.
 * Must be used within a Message component.
 */
declare function useMessage(): MessageContextValue;
interface MessageProps extends HTMLAttributes<HTMLDivElement> {
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
declare const Message: react.ForwardRefExoticComponent<MessageProps & react.RefAttributes<HTMLDivElement>>;
interface MessageContentProps extends HTMLAttributes<HTMLDivElement> {
    /** Custom content to render instead of message text */
    children?: ReactNode;
}
/**
 * Renders the message content.
 * By default renders the message's textContent.
 */
declare const MessageContent: react.ForwardRefExoticComponent<MessageContentProps & react.RefAttributes<HTMLDivElement>>;
interface MessageTimestampProps extends HTMLAttributes<HTMLSpanElement> {
    /** Custom date formatter */
    format?: (date: Date) => string;
}
/**
 * Renders the message timestamp.
 */
declare const MessageTimestamp: react.ForwardRefExoticComponent<MessageTimestampProps & react.RefAttributes<HTMLSpanElement>>;

interface ComposerContextValue {
    content: string;
    isSubmitting: boolean;
    canSubmit: boolean;
    error: string | null;
    handleContentChange: (value: string) => void;
    handleSubmit: () => Promise<void>;
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
}
declare const ComposerContext: react.Context<ComposerContextValue | null>;
/**
 * Hook to access the composer context.
 * Must be used within a MessageComposer component.
 */
declare function useComposer(): ComposerContextValue;
interface MessageComposerProps {
    /** Callback when message is submitted */
    onSubmit: (content: string, attachments?: File[]) => Promise<void>;
    /** Whether the composer is disabled */
    disabled?: boolean;
    /** Children to render inside the composer */
    children: ReactNode;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Headless MessageComposer primitive.
 * Provides composer state and behavior to children.
 */
declare const MessageComposer: react.ForwardRefExoticComponent<MessageComposerProps & react.RefAttributes<HTMLFormElement>>;
interface ComposerInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
}
/**
 * Text input for the message composer.
 */
declare const ComposerInput: react.ForwardRefExoticComponent<ComposerInputProps & react.RefAttributes<HTMLTextAreaElement>>;
interface ComposerSubmitProps extends ButtonHTMLAttributes<HTMLButtonElement> {
}
/**
 * Submit button for the message composer.
 */
declare const ComposerSubmit: react.ForwardRefExoticComponent<ComposerSubmitProps & react.RefAttributes<HTMLButtonElement>>;

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
    /** Name for fallback initials */
    name?: string;
    /** Image URL */
    src?: string;
    /** Alt text for image */
    alt?: string;
    /** Participant role for styling */
    role?: ParticipantRole;
    /** Fallback content when no image or name */
    fallback?: React.ReactNode;
}
/**
 * Headless Avatar primitive.
 * Renders an image or fallback initials.
 */
declare const Avatar: react.ForwardRefExoticComponent<AvatarProps & react.RefAttributes<HTMLDivElement>>;

export { Avatar as A, ComposerInput as C, Message as M, MessageContent as a, MessageTimestamp as b, MessageContext as c, MessageComposer as d, ComposerSubmit as e, ComposerContext as f, useComposer as g, type AvatarProps as h, type MessageProps as i, type MessageContentProps as j, type MessageTimestampProps as k, type MessageComposerProps as l, type ComposerInputProps as m, type ComposerSubmitProps as n, useMessage as u };
