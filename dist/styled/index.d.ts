export { f as AttachmentPreview, g as AttachmentPreviewProps, A as Avatar, h as AvatarProps, C as ChatContainer, i as ChatContainerProps, a as ChatLayout, q as ChatLayoutProps, e as MarkdownContent, j as MarkdownContentProps, b as Message, c as MessageComposer, l as MessageComposerProps, M as MessageList, m as MessageListProps, k as MessageProps, d as StreamingText, n as StreamingTextProps, S as SuggestedActions, o as SuggestedActionsProps, T as TypingIndicator, p as TypingIndicatorProps, W as WelcomeScreen, r as WelcomeScreenProps } from '../WelcomeScreen-DY5oQa5M.js';
import * as react_jsx_runtime from 'react/jsx-runtime';
import react__default, { ReactNode } from 'react';
import { A as Attachment, c as SourceReference } from '../message-SQ4slgBA.js';
export { C as ChatMessage, M as MessageData, a as Participant, P as ParticipantRole, d as SourceTypeConfig, S as SuggestedAction, b as SuggestedActionType } from '../message-SQ4slgBA.js';
import { S as StreamingChunk, P as PlanData, C as ClarificationData, V as VisualizationChunkData, d as ChartVisualizationData, e as VisualizationConfig, T as TableVisualizationData, f as CardVisualizationData, K as KpiVisualizationData, g as CodePreviewVisualizationData, F as FormVisualizationData, E as Event, h as EventStatus } from '../streaming-DsSwtonH.js';
export { i as ChunkType, z as ClaudeToolChunkData, j as EventType, v as FileOperationChunkData, k as FollowupAction, O as ObservationEvent, s as ParallelSubtaskData, l as PlanningEvent, m as ProgressData, x as SearchResultsChunkData, n as StreamingMessage, o as SubTaskData, u as SubagentChunkData, t as SubagentInfo, p as SubtaskEvent, w as TerminalChunkData, q as ThinkingEvent, r as ToolEvent, A as VisualizationType, W as WaveData, y as WebOperationChunkData } from '../streaming-DsSwtonH.js';
export { ChatContextValue, ChatProvider, ChatProviderProps, useChatContext } from '../context/index.js';
export { B as BrandingData } from '../branding-SzYU4ncD.js';
export { g as useComposer, u as useMessage } from '../avatar-Dsrx9AN1.js';

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

interface TimeMarkerProps {
    /** The label to display (e.g. "Today", "Yesterday", "Monday") */
    label: string;
    /** Additional CSS classes */
    className?: string;
}
/**
 * Centered time separator between message groups.
 * Displays a label like "Today" or "Yesterday" with horizontal rules.
 */
declare function TimeMarker({ label, className }: TimeMarkerProps): react_jsx_runtime.JSX.Element;

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
    /** Streaming chunks */
    chunks?: StreamingChunk[];
    /** Execution plan for Plan & Execute mode */
    plan?: PlanData;
    /** Execution timeline (completed messages) */
    executionTimeline?: any[];
    /** User message timestamp for duration calculation */
    userMessageTimestamp?: number;
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
declare function ReasoningPanel({ isStreaming, chunks, plan, executionTimeline, userMessageTimestamp, executionTime, defaultExpanded, expanded: controlledExpanded, onExpandedChange, className, }: ReasoningPanelProps): react_jsx_runtime.JSX.Element | null;

interface ClarificationPanelProps {
    clarification: ClarificationData;
    onSubmit: (response: string) => void;
    onOptionSelect?: (option: string) => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
}
/**
 * Stateless clarification panel - displays when the AI agent needs user input.
 * Orange left-border panel with question, radio options, and free-text input.
 */
declare function ClarificationPanel({ clarification, onSubmit, onOptionSelect, disabled, loading, className, }: ClarificationPanelProps): react_jsx_runtime.JSX.Element;

interface CitationSourcesProps {
    sources: SourceReference[];
    className?: string;
}
/**
 * Renders citation sources as a horizontal row of clickable chips.
 * Clicking a chip opens a modal showing full source content.
 */
declare function CitationSources({ sources, className }: CitationSourcesProps): react_jsx_runtime.JSX.Element | null;
interface SourceDetailModalProps {
    source: SourceReference | null;
    onClose: () => void;
}
declare function SourceDetailModal({ source, onClose, }: SourceDetailModalProps): react_jsx_runtime.JSX.Element | null;
/**
 * Inline citation badge - renders a small numbered badge like [1]
 * with optional tooltip on hover and click-to-open URL.
 */
interface InlineCitationProps {
    index: number;
    source?: SourceReference;
}
declare function InlineCitation({ index, source }: InlineCitationProps): react_jsx_runtime.JSX.Element;

interface ClaudeToolPreviewProps {
    chunk: StreamingChunk;
}
declare function ClaudeToolPreview({ chunk }: ClaudeToolPreviewProps): react_jsx_runtime.JSX.Element | null;

interface TerminalOutputProps {
    chunk: StreamingChunk;
}
declare function TerminalOutput({ chunk }: TerminalOutputProps): react_jsx_runtime.JSX.Element | null;

interface FileOperationPreviewProps {
    chunk: StreamingChunk;
}
declare function FileOperationPreview({ chunk }: FileOperationPreviewProps): react_jsx_runtime.JSX.Element | null;

interface SearchResultsViewProps {
    chunk: StreamingChunk;
}
declare function SearchResultsView({ chunk }: SearchResultsViewProps): react_jsx_runtime.JSX.Element | null;

interface WebOperationPreviewProps {
    chunk: StreamingChunk;
}
declare function WebOperationPreview({ chunk }: WebOperationPreviewProps): react_jsx_runtime.JSX.Element | null;

interface SubagentPanelProps {
    chunk: StreamingChunk;
}
declare function SubagentPanel({ chunk }: SubagentPanelProps): react_jsx_runtime.JSX.Element | null;

interface VisualizationRendererProps {
    data: VisualizationChunkData;
    isStreaming?: boolean;
}
declare function VisualizationRenderer({ data, isStreaming }: VisualizationRendererProps): react_jsx_runtime.JSX.Element;

interface ChartVisualizationProps {
    data: ChartVisualizationData;
    config?: VisualizationConfig;
    isStreaming?: boolean;
}
declare function ChartVisualization({ data, config, isStreaming }: ChartVisualizationProps): react_jsx_runtime.JSX.Element;

interface TableVisualizationProps {
    data: TableVisualizationData;
    config?: VisualizationConfig;
    isStreaming?: boolean;
}
declare function TableVisualization({ data, config }: TableVisualizationProps): react_jsx_runtime.JSX.Element;

interface CardVisualizationProps {
    data: CardVisualizationData;
    config?: VisualizationConfig;
    isStreaming?: boolean;
}
declare function CardVisualization({ data, config }: CardVisualizationProps): react_jsx_runtime.JSX.Element;

interface KpiVisualizationProps {
    data: KpiVisualizationData;
    config?: VisualizationConfig;
    isStreaming?: boolean;
}
declare function KpiVisualization({ data, config, isStreaming }: KpiVisualizationProps): react_jsx_runtime.JSX.Element;

interface CodePreviewVisualizationProps {
    data: CodePreviewVisualizationData;
    config?: VisualizationConfig;
    isStreaming?: boolean;
}
declare function CodePreviewVisualization({ data }: CodePreviewVisualizationProps): react_jsx_runtime.JSX.Element;

interface FormVisualizationProps {
    data: FormVisualizationData;
    config?: VisualizationConfig;
    isStreaming?: boolean;
}
declare function FormVisualization({ data, config, isStreaming }: FormVisualizationProps): react_jsx_runtime.JSX.Element;

interface EventContentProps {
    event: Event;
    className?: string;
    /** When true, shows beamer scanning effect on tool items */
    isRunning?: boolean;
}
/**
 * Renders content for different event types
 * - Thinking: Markdown content with subtle styling
 * - Planning: Markdown content with planning context
 * - Tool: Inline icon + text display with beamer effect when running
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
 * Minimal timeline for Plan & Execute mode.
 * Matches in-house style: simple "Plan:" header + inline text rows.
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

export { Attachment, CardVisualization, type CardVisualizationProps, ChartVisualization, type ChartVisualizationProps, ChatHeader, type ChatHeaderAction, type ChatHeaderProps, CitationSources, type CitationSourcesProps, ClarificationData, ClarificationPanel, type ClarificationPanelProps, ClaudeToolPreview, type ClaudeToolPreviewProps, CodePreviewVisualization, type CodePreviewVisualizationProps, Event, EventContent, EventStatus, EventTimeline, type EventTimelineProps, FileOperationPreview, type FileOperationPreviewProps, FormVisualization, type FormVisualizationProps, InlineCitation, type InlineCitationProps, KpiVisualization, type KpiVisualizationProps, LoadingDots, type LoadingDotsProps, MessageAttachments, type MessageAttachmentsProps, PlanData, PlanTimeline, type PlanTimelineProps, ReasoningPanel, type ReasoningPanelProps, SearchResultsView, type SearchResultsViewProps, SourceDetailModal, type SourceDetailModalProps, SourceReference, StatusBadge, StreamingChunk, SubagentPanel, type SubagentPanelProps, TableVisualization, type TableVisualizationProps, TerminalOutput, type TerminalOutputProps, TimeMarker, type TimeMarkerProps, Timeline, TimelineItem, type TimelineItemData, type TimelineItemProps, type TimelineProps, VisualizationChunkData, VisualizationConfig, VisualizationRenderer, type VisualizationRendererProps, WebOperationPreview, type WebOperationPreviewProps, convertChunkToEvent, convertTimelineToEvents };
