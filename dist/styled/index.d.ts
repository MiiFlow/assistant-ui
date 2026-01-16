export { e as AttachmentPreview, f as AttachmentPreviewProps, A as Avatar, g as AvatarProps, C as ChatContainer, h as ChatContainerProps, d as MarkdownContent, i as MarkdownContentProps, a as Message, b as MessageComposer, k as MessageComposerProps, M as MessageList, l as MessageListProps, j as MessageProps, c as StreamingText, m as StreamingTextProps, S as SuggestedActions, n as SuggestedActionsProps, T as TypingIndicator, o as TypingIndicatorProps } from '../TypingIndicator-CiEEj8r8.js';
import * as react_jsx_runtime from 'react/jsx-runtime';
import react__default, { ReactNode } from 'react';
import { A as Attachment } from '../message-ClH8xF3o.js';
export { C as ChatMessage, M as MessageData, a as Participant, P as ParticipantRole, S as SuggestedAction } from '../message-ClH8xF3o.js';
import { S as StreamingChunk, P as PlanData, E as Event, d as EventStatus } from '../streaming-beXFE8Rc.js';
export { C as ChunkType, e as EventType, F as FollowupAction, O as ObservationEvent, f as PlanningEvent, g as ProgressData, h as StreamingMessage, i as SubTaskData, j as SubtaskEvent, T as ThinkingEvent, k as ToolEvent } from '../streaming-beXFE8Rc.js';
export { ChatContextValue, ChatProvider, ChatProviderProps, useChatContext } from '../context/index.js';
export { g as useComposer, u as useMessage } from '../avatar-BJ276Koq.js';

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

interface EventContentProps {
    event: Event;
    className?: string;
    /** When true, shows animated gradient border effect */
    isRunning?: boolean;
}
/**
 * Renders content for different event types
 * - Thinking: Markdown content with subtle styling
 * - Planning: Markdown content with planning context
 * - Tool: Chip-style display with tool name (+ gradient border when running)
 * - Observation: Colored result panel
 */
declare function EventContent({ event, className, isRunning }: EventContentProps): react_jsx_runtime.JSX.Element | null;

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

interface StatusBadgeProps {
    status: EventStatus;
    size?: number;
    className?: string;
}
/**
 * Circular status badge with magical animations
 * - Pending: Dashed circle (muted)
 * - Running: Glowing orb with pulse effect
 * - Completed: Green check with pop + flash animation
 * - Failed: Red X
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

export { Attachment, ChatHeader, type ChatHeaderAction, type ChatHeaderProps, Event, EventContent, EventStatus, EventTimeline, type EventTimelineProps, LoadingDots, type LoadingDotsProps, MessageAttachments, type MessageAttachmentsProps, PlanData, PlanTimeline, type PlanTimelineProps, ReasoningPanel, type ReasoningPanelProps, StatusBadge, StreamingChunk, Timeline, TimelineItem, type TimelineItemData, type TimelineItemProps, type TimelineProps, convertChunkToEvent, convertTimelineToEvents };
