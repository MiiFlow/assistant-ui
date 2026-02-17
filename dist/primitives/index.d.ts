export { A as Avatar, h as AvatarProps, f as ComposerContext, C as ComposerInput, m as ComposerInputProps, e as ComposerSubmit, n as ComposerSubmitProps, M as Message, d as MessageComposer, l as MessageComposerProps, a as MessageContent, j as MessageContentProps, c as MessageContext, i as MessageProps, b as MessageTimestamp, k as MessageTimestampProps, g as useComposer, u as useMessage } from '../avatar-Dsrx9AN1.js';
import * as react from 'react';
import { HTMLAttributes, ReactNode, ButtonHTMLAttributes } from 'react';
import { S as SuggestedAction } from '../message-SQ4slgBA.js';
import '../streaming-DsSwtonH.js';

interface MessageListProps extends HTMLAttributes<HTMLDivElement> {
    /** Messages to render */
    children: ReactNode;
    /** Whether to auto-scroll to bottom on new messages */
    autoScroll?: boolean;
    /** Threshold from bottom to trigger auto-scroll (pixels) */
    scrollThreshold?: number;
}
/**
 * Headless MessageList primitive.
 * Provides a scrollable container with auto-scroll behavior.
 */
declare const MessageList: react.ForwardRefExoticComponent<MessageListProps & react.RefAttributes<HTMLDivElement>>;

interface StreamingTextProps extends HTMLAttributes<HTMLDivElement> {
    /** The content to display */
    content: string;
    /** Whether the text is currently streaming */
    isStreaming?: boolean;
    /** Show a cursor indicator while streaming */
    showCursor?: boolean;
    /** Custom cursor element */
    cursor?: ReactNode;
    /** Children override (takes precedence over content) */
    children?: ReactNode;
}
/**
 * Headless StreamingText primitive.
 * Renders text with streaming indicator support.
 */
declare const StreamingText: react.ForwardRefExoticComponent<StreamingTextProps & react.RefAttributes<HTMLDivElement>>;

interface SuggestedActionsContextValue {
    actions: SuggestedAction[];
    onSelect: (action: SuggestedAction) => void;
}
declare const SuggestedActionsContext: react.Context<SuggestedActionsContextValue | null>;
/**
 * Hook to access suggested actions context.
 */
declare function useSuggestedActions(): SuggestedActionsContextValue;
interface SuggestedActionsProps {
    /** List of suggested actions */
    actions: SuggestedAction[];
    /** Callback when an action is selected */
    onSelect: (action: SuggestedAction) => void;
    /** Children to render */
    children: ReactNode;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Headless SuggestedActions primitive.
 * Provides context for rendering action buttons.
 */
declare const SuggestedActions: react.ForwardRefExoticComponent<SuggestedActionsProps & react.RefAttributes<HTMLDivElement>>;
interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** The action this button represents */
    action: SuggestedAction;
    /** Children to render inside button */
    children?: ReactNode;
}
/**
 * Button for a suggested action.
 */
declare const ActionButton: react.ForwardRefExoticComponent<ActionButtonProps & react.RefAttributes<HTMLButtonElement>>;

interface TypingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
    /** Custom content to show while typing */
    children?: ReactNode;
    /** Number of dots to show */
    dotCount?: number;
}
/**
 * Headless TypingIndicator primitive.
 * Shows animated dots or custom content.
 */
declare const TypingIndicator: react.ForwardRefExoticComponent<TypingIndicatorProps & react.RefAttributes<HTMLDivElement>>;

export { ActionButton, type ActionButtonProps, MessageList, type MessageListProps, StreamingText, type StreamingTextProps, SuggestedActions, SuggestedActionsContext, type SuggestedActionsProps, TypingIndicator, type TypingIndicatorProps, useSuggestedActions };
