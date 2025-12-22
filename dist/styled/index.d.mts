export { e as AttachmentPreview, o as AttachmentPreviewProps, A as Avatar, j as AvatarProps, C as ChatContainer, f as ChatContainerProps, d as MarkdownContent, n as MarkdownContentProps, a as Message, b as MessageComposer, i as MessageComposerProps, M as MessageList, g as MessageListProps, h as MessageProps, c as StreamingText, m as StreamingTextProps, S as SuggestedActions, l as SuggestedActionsProps, T as TypingIndicator, k as TypingIndicatorProps } from '../AttachmentPreview-BA2s4y0V.mjs';
import * as react_jsx_runtime from 'react/jsx-runtime';
import react__default, { ReactNode } from 'react';
import { S as StreamingChunk, P as PlanData, E as EventStatus, d as Event } from '../streaming-Dsbi9aRq.mjs';
export { C as ChunkType, h as EventType, F as FollowupAction, O as ObservationEvent, i as PlanningEvent, g as ProgressData, e as StreamingMessage, f as SubTaskData, k as SubtaskEvent, T as ThinkingEvent, j as ToolEvent } from '../streaming-Dsbi9aRq.mjs';
import { A as Attachment } from '../message-DCsGigy0.mjs';
export { C as ChatMessage, M as MessageData, a as Participant, P as ParticipantRole, S as SuggestedAction } from '../message-DCsGigy0.mjs';
export { ChatContextValue, ChatProvider, ChatProviderProps, useChatContext } from '../context/index.mjs';
export { g as useComposer, u as useMessage } from '../avatar-m-_wlqIZ.mjs';

interface LoadingDotsProps {
    /** Size variant */
    size?: "small" | "medium" | "large";
    /** Additional CSS classes */
    className?: string;
}
/**
 * Animated loading dots indicator
 */
declare function LoadingDots({ size, className }: LoadingDotsProps): react_jsx_runtime.JSX.Element;

interface ChatHeaderAction {
    id: string;
    label: string;
    icon?: react__default.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}
interface ChatHeaderProps {
    /** Assistant/chat title */
    title: string;
    /** Optional subtitle/description */
    subtitle?: string;
    /** Logo URL or element */
    logo?: string | react__default.ReactNode;
    /** Menu actions */
    actions?: ChatHeaderAction[];
    /** Show close button */
    showClose?: boolean;
    /** Close button handler */
    onClose?: () => void;
    /** Loading state */
    loading?: boolean;
    /** Additional class names */
    className?: string;
    /** Custom styles via CSS variables */
    style?: react__default.CSSProperties;
}
declare function ChatHeader({ title, subtitle, logo, actions, showClose, onClose, loading, className, style, }: ChatHeaderProps): react_jsx_runtime.JSX.Element;

interface ReasoningPanelProps {
    /** Whether currently streaming */
    isStreaming?: boolean;
    /** Streaming chunks (thinking, tool calls, etc.) */
    chunks?: StreamingChunk[];
    /** Execution plan for Plan & Execute mode */
    plan?: PlanData;
    /** Total execution time in seconds */
    executionTime?: number;
    /** Whether expanded by default */
    defaultExpanded?: boolean;
    /** Controlled expanded state */
    expanded?: boolean;
    /** Callback when expanded state changes */
    onExpandedChange?: (expanded: boolean) => void;
    /** Additional class names */
    className?: string;
}
/**
 * Collapsible panel showing AI reasoning, tool execution, and planning
 * Matches main app's ReasoningPanel functionality
 */
declare function ReasoningPanel({ isStreaming, chunks, plan, executionTime, defaultExpanded, expanded: controlledExpanded, onExpandedChange, className, }: ReasoningPanelProps): react_jsx_runtime.JSX.Element | null;

interface MessageAttachmentsProps {
    /** List of attachments to display */
    attachments: Attachment[];
    /** Custom download handler */
    onDownload?: (attachment: Attachment) => void;
    /** Custom preview handler */
    onPreview?: (attachment: Attachment) => void;
    /** Additional class names */
    className?: string;
}
/**
 * Display attachments (images, videos, documents) in messages
 */
declare function MessageAttachments({ attachments, onDownload, onPreview, className, }: MessageAttachmentsProps): react_jsx_runtime.JSX.Element | null;

interface StatusBadgeProps {
    status: EventStatus;
    size?: number;
    className?: string;
}
/**
 * Circular status badge with animations
 * - Pending: Dashed circle
 * - Running: Animated spinning loader
 * - Completed: Check circle
 * - Failed: X circle
 */
declare function StatusBadge({ status, size, className }: StatusBadgeProps): react_jsx_runtime.JSX.Element;

interface TimelineItemData {
    id: string;
    status: EventStatus;
    content: ReactNode;
}
interface TimelineProps {
    items: TimelineItemData[];
    badgeSize?: number;
    className?: string;
}
/**
 * Vertical timeline component
 * Displays items with status badges and connecting lines
 */
declare function Timeline({ items, badgeSize, className }: TimelineProps): react_jsx_runtime.JSX.Element | null;
interface TimelineItemProps {
    status: EventStatus;
    isLast?: boolean;
    badgeSize?: number;
    children: ReactNode;
    className?: string;
}
/**
 * Single timeline item (alternative API)
 */
declare function TimelineItem({ status, isLast, badgeSize, children, className, }: TimelineItemProps): react_jsx_runtime.JSX.Element;

/**
 * Convert StreamingChunk to Event format
 */
declare function convertChunkToEvent(chunk: StreamingChunk, index: number): Event | null;
/**
 * Convert timeline items (from metadata) to Events
 */
declare function convertTimelineToEvents(timeline: Array<Record<string, unknown>>): Event[];
interface EventTimelineProps {
    events: Event[];
    isStreaming?: boolean;
    className?: string;
}
/**
 * Unified event timeline component
 * Displays thinking, tool execution, and observation events
 */
declare function EventTimeline({ events, className }: EventTimelineProps): react_jsx_runtime.JSX.Element | null;

interface EventContentProps {
    event: Event;
    className?: string;
}
/**
 * Renders content for different event types
 * - Thinking: Markdown content with subtle styling
 * - Planning: Markdown content with planning context
 * - Tool: Chip-style display with tool name
 * - Observation: Colored result panel
 */
declare function EventContent({ event, className }: EventContentProps): react_jsx_runtime.JSX.Element | null;

interface PlanTimelineProps {
    plan: PlanData;
    streamingChunks?: StreamingChunk[];
    className?: string;
}
/**
 * Timeline visualization for Plan & Execute mode
 * Shows plan with expandable subtasks
 */
declare function PlanTimeline({ plan, streamingChunks, className, }: PlanTimelineProps): react_jsx_runtime.JSX.Element;

export { Attachment, ChatHeader, type ChatHeaderAction, type ChatHeaderProps, Event, EventContent, EventStatus, EventTimeline, type EventTimelineProps, LoadingDots, type LoadingDotsProps, MessageAttachments, type MessageAttachmentsProps, PlanData, PlanTimeline, type PlanTimelineProps, ReasoningPanel, type ReasoningPanelProps, StatusBadge, StreamingChunk, Timeline, TimelineItem, type TimelineItemData, type TimelineItemProps, type TimelineProps, convertChunkToEvent, convertTimelineToEvents };
