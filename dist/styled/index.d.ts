export { A as AttachmentPreview, j as AttachmentPreviewProps, a as Avatar, k as AvatarProps, C as ChatContainer, l as ChatContainerProps, b as ChatLayout, m as ChatLayoutProps, M as MarkdownContent, n as MarkdownContentProps, c as Message, d as MessageActionBar, o as MessageActionBarProps, e as MessageComposer, p as MessageComposerProps, f as MessageList, q as MessageListProps, r as MessageProps, S as ScrollToBottomButton, s as ScrollToBottomButtonProps, g as StreamingText, t as StreamingTextProps, h as SuggestedActions, u as SuggestedActionsProps, v as ToolStatus, T as ToolStatusIndicator, w as ToolStatusIndicatorProps, i as TypingIndicator, x as TypingIndicatorProps, W as WelcomeScreen, y as WelcomeScreenProps } from '../WelcomeScreen-C91_sR2U.js';
import * as react_jsx_runtime from 'react/jsx-runtime';
import react__default, { ReactNode, ComponentType } from 'react';
import { A as Attachment, S as SourceReference } from '../message-CXR79XEX.js';
export { C as ChatMessage, M as MessageData, a as MessageError, b as Participant, P as ParticipantRole, c as SourceTypeConfig, d as SuggestedAction, e as SuggestedActionType } from '../message-CXR79XEX.js';
import { S as StreamingChunk, P as PlanData, C as ClarificationData, T as ToolApprovalData, V as VisualizationChunkData, d as VisualizationActionEvent, M as MediaChunkData, e as ChartVisualizationData, f as VisualizationConfig, g as TableVisualizationData, h as CardVisualizationData, K as KpiVisualizationData, i as CodePreviewVisualizationData, F as FormVisualizationData, A as ArtifactChunkData, E as Event, j as EventStatus } from '../streaming-CE9i2L8q.js';
export { k as ArtifactStatus, l as ChunkType, m as EventType, n as FollowupAction, O as ObservationEvent, o as PlanningEvent, p as ProgressData, q as StreamingMessage, r as SubTaskData, s as SubagentChunkData, t as SubtaskEvent, u as ThinkingEvent, v as ToolEvent, w as VisualizationType } from '../streaming-CE9i2L8q.js';
import { z, ZodSchema } from 'zod';
export { ChatContextValue, ChatProvider, ChatProviderProps, useChatContext } from '../context/index.js';
export { B as BrandingData } from '../branding-NieTEGQf.js';
export { u as useComposer, g as useMessage } from '../avatar-5oxmVS1J.js';
import '../types-Du00UBst.js';

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
    /** Execution plan persisted on completed messages (historical messages only —
     *  new streams persist the plan as plain text without subtasks). */
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
    onSubmit?: (response: string) => void;
    onOptionSelect?: (option: string) => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    /**
     * When set, renders a read-only "answered" state showing the user's response
     * inline with the question. Used in scrolled-back chat history so a past
     * clarification still shows what was asked and answered.
     */
    answer?: string;
}
/**
 * Stateless clarification panel - displays when the AI agent needs user input.
 * Orange left-border panel with question, radio options, and free-text input.
 *
 * If `answer` is provided, switches to a read-only "answered" view.
 */
declare function ClarificationPanel({ clarification, onSubmit, onOptionSelect, disabled, loading, className, answer, }: ClarificationPanelProps): react_jsx_runtime.JSX.Element;

interface ApprovalButtonSlotProps {
    onClick: () => void;
    disabled?: boolean;
    children: ReactNode;
}
interface ApprovalChatInputSlotProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    placeholder: string;
    disabled?: boolean;
    autoFocus?: boolean;
}
interface ToolApprovalSlots {
    AllowButton?: ComponentType<ApprovalButtonSlotProps>;
    RejectButton?: ComponentType<ApprovalButtonSlotProps>;
    ChatButton?: ComponentType<ApprovalButtonSlotProps>;
    SendButton?: ComponentType<ApprovalButtonSlotProps>;
    CancelButton?: ComponentType<ApprovalButtonSlotProps>;
    ChatInput?: ComponentType<ApprovalChatInputSlotProps>;
}
interface ToolApprovalPanelProps {
    approval: ToolApprovalData;
    onApprove: (modifiedInputs: Record<string, unknown>) => void;
    onReject: (reason?: string) => void;
    disabled?: boolean;
    className?: string;
    /**
     * Per-action component overrides. Pass any subset; unspecified slots fall
     * back to the library's default Tailwind-styled renderings. Use this to
     * align buttons and input with a host app's brand system.
     */
    slots?: ToolApprovalSlots;
}
/**
 * Tool approval — rendered as an inline assistant turn rather than a card.
 * The agent's question reads as plain prose; actions sit beneath as a primary
 * pill, a quiet secondary pill, and a text link for free-text redirect.
 *
 * Buttons and the chat input are slottable via the `slots` prop so host apps
 * can swap in their own brand-aligned components.
 */
declare function ToolApprovalPanel({ approval, onApprove, onReject, disabled, className, slots, }: ToolApprovalPanelProps): react_jsx_runtime.JSX.Element;

interface CitationSourcesProps {
    sources: SourceReference[];
    className?: string;
}
/**
 * Renders citation sources as a horizontal row of clickable chips.
 * Clicking a chip opens a modal showing full source content.
 */
declare function CitationSources({ sources, className, }: CitationSourcesProps): react_jsx_runtime.JSX.Element | null;
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

interface SubagentPanelProps {
    chunk: StreamingChunk;
}
/**
 * Renders a single sub-assistant dispatch as one row in a `Timeline` —
 * label + description + duration + chevron — matching plan subtasks and
 * multi-agent rows. Nested chunks (thinking/tool/observation/sub-assistant)
 * render as an indented `EventTimeline` underneath.
 */
declare function SubagentPanel({ chunk }: SubagentPanelProps): react_jsx_runtime.JSX.Element | null;

declare const chartVisualizationSchema: z.ZodObject<{
    chartType: z.ZodEnum<{
        line: "line";
        bar: "bar";
        pie: "pie";
        area: "area";
        scatter: "scatter";
        composed: "composed";
    }>;
    series: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        data: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            x: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            y: z.ZodNumber;
        }, z.core.$strip>, z.ZodObject<{
            name: z.ZodString;
            value: z.ZodNumber;
        }, z.core.$strip>]>>;
        color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    xAxis: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            number: "number";
            category: "category";
            time: "time";
        }>>>;
        min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.core.$strip>>>;
    yAxis: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            number: "number";
            category: "category";
            time: "time";
        }>>>;
        min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
declare const tableVisualizationSchema: z.ZodObject<{
    columns: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        type: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            progress: "progress";
            media: "media";
            currency: "currency";
            date: "date";
            badge: "badge";
            link: "link";
        }>>>;
        align: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            left: "left";
            center: "center";
            right: "right";
        }>>>;
        width: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    rows: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
declare const cardVisualizationSchema: z.ZodObject<{
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sections: z.ZodArray<z.ZodObject<{
        title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        items: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        }, z.core.$strip>>>>;
        content: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    actions: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        action: z.ZodString;
        variant: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            primary: "primary";
            secondary: "secondary";
            text: "text";
        }>>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
declare const kpiVisualizationSchema: z.ZodObject<{
    metrics: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        unit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        trend: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
            up: "up";
            down: "down";
            neutral: "neutral";
        }>>>;
        change: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
        changeLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sparkline: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber>>>;
        color: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
    layout: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        row: "row";
        grid: "grid";
        bento: "bento";
    }>>>;
}, z.core.$strip>;
declare const codePreviewVisualizationSchema: z.ZodObject<{
    code: z.ZodString;
    language: z.ZodString;
    lineNumbers: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
    highlightLines: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodNumber>>>;
    startLine: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
declare const formVisualizationSchema: z.ZodObject<{
    fields: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<{
            number: "number";
            date: "date";
            text: "text";
            email: "email";
            select: "select";
            multiselect: "multiselect";
            checkbox: "checkbox";
            radio: "radio";
            textarea: "textarea";
            datetime: "datetime";
        }>;
        label: z.ZodString;
        required: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        placeholder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        options: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            label: z.ZodString;
        }, z.core.$strip>>>>;
        defaultValue: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
        validation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            min: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            max: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            pattern: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    submitAction: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;

interface VisualizationRendererProps {
    data: VisualizationChunkData;
    isStreaming?: boolean;
    onAction?: (event: VisualizationActionEvent) => void;
    /** Message-level media bag used to resolve `media_ref:<id>` cell values. */
    medias?: MediaChunkData[];
}
declare function VisualizationRenderer({ data, isStreaming, onAction, medias, }: VisualizationRendererProps): react_jsx_runtime.JSX.Element;

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
    /** Message-level media bag used to resolve `media_ref:<id>` cell values. */
    medias?: MediaChunkData[];
}
declare function TableVisualization({ data, config, medias }: TableVisualizationProps): react_jsx_runtime.JSX.Element;

interface CardVisualizationProps {
    data: CardVisualizationData;
    config?: VisualizationConfig;
    isStreaming?: boolean;
    onAction?: (event: VisualizationActionEvent) => void;
}
declare function CardVisualization({ data, config, onAction }: CardVisualizationProps): react_jsx_runtime.JSX.Element;

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
    onAction?: (event: VisualizationActionEvent) => void;
}
declare function FormVisualization({ data, config, isStreaming, onAction }: FormVisualizationProps): react_jsx_runtime.JSX.Element;

interface VisualizationEntry {
    component: React.ComponentType<{
        data: any;
        config?: VisualizationConfig;
        isStreaming?: boolean;
        onAction?: (event: VisualizationActionEvent) => void;
        medias?: MediaChunkData[];
    }>;
    schema?: ZodSchema;
}
/**
 * Register a visualization type. Built-in types are registered at module load.
 * Consumers can call this to add custom visualization types.
 */
declare function registerVisualization(type: string, entry: VisualizationEntry): void;
/**
 * Look up a registered visualization by type string.
 */
declare function getVisualization(type: string): VisualizationEntry | undefined;
/**
 * Return all registered visualization type strings.
 */
declare function getRegisteredTypes(): string[];

interface ArtifactInlineCardProps {
    artifact: ArtifactChunkData;
    isStreaming?: boolean;
    onOpen?: (artifact: ArtifactChunkData) => void;
}
/**
 * Unstyled primitive inline card. The app layer (`web/`) registers a
 * MUI-skinned version via `registerArtifact`; this primitive is the fallback
 * shipped with the chat-ui package so headless / embedded consumers still
 * render something when a tool emits an artifact.
 */
declare function ArtifactInlineCard({ artifact, isStreaming, onOpen, }: ArtifactInlineCardProps): react_jsx_runtime.JSX.Element;

interface ArtifactListProps {
    artifacts: ArtifactChunkData[];
    isStreaming?: boolean;
    onOpen?: (artifact: ArtifactChunkData) => void;
}
/**
 * Renders one inline card per artifact using the registered renderer when
 * available; falls back to the unstyled `ArtifactInlineCard` otherwise.
 */
declare function ArtifactList({ artifacts, isStreaming, onOpen, }: ArtifactListProps): react_jsx_runtime.JSX.Element | null;

/**
 * Shape of a registered artifact type.
 *
 * Artifacts have a dual UI:
 *  - `InlineCard` is rendered inside the message body (compact, clickable).
 *  - `Viewer` is rendered inside the side-panel drawer (full preview).
 *
 * The app layer (`web/`) supplies MUI-skinned implementations; the unstyled
 * primitive `ArtifactInlineCard` is used as a fallback for headless consumers
 * (e.g. the embedded widget) that do not register MUI artifacts.
 */
interface ArtifactEntry {
    type: string;
    label: string;
    icon?: ComponentType<{
        className?: string;
    }>;
    InlineCard: ComponentType<{
        artifact: ArtifactChunkData;
        isStreaming?: boolean;
        onOpen?: (artifact: ArtifactChunkData) => void;
    }>;
    Viewer?: ComponentType<{
        artifact: ArtifactChunkData;
    }>;
    /** Optional description shown when no entry is registered for this type. */
    fallback?: ReactNode;
}
declare function registerArtifact(type: string, entry: ArtifactEntry): void;
declare function getArtifact(type: string): ArtifactEntry | undefined;
declare function getRegisteredArtifactTypes(): string[];

interface EventContentProps {
    event: Event;
    className?: string;
    /** Active state — drives the trailing caret on tool calls. */
    isRunning?: boolean;
    /**
     * Slowest duration in the surrounding timeline. Used to scale this row's
     * trailing micro-bar so the panel reads as a proportional trace.
     */
    maxDurationSeconds?: number;
}
/**
 * Refreshed event content.
 *
 * - Thinking / planning render as prose at 78% ink with relaxed leading;
 *   active rows bump to weight 500 so the eye lands on live content.
 * - Tool calls render as an inline monospace tag. The redundant inner dot
 *   is gone (the rail badge already conveys state at the same y); a soft
 *   caret blinks at the trailing edge while running.
 * - Completed rows get a right-aligned duration with a proportional micro-
 *   bar — the panel reads as a tiny trace.
 * - Observations use a quiet tinted background, no side-stripe.
 */
declare function EventContent({ event, className, isRunning, maxDurationSeconds, }: EventContentProps): react_jsx_runtime.JSX.Element | null;

/**
 * Convert StreamingChunk to Event format
 */
declare function convertChunkToEvent(chunk: StreamingChunk, index: number): Event | null;
/**
 * Convert timeline items (from metadata) to Events.
 *
 * Computes pairwise `durationSeconds` from `item.timestamp` so completed
 * timelines can show per-step trace bars. Falls back to undefined when
 * timestamps are missing (e.g. tail events without a successor).
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

type TimelineItemKind = "thinking" | "planning" | "tool" | "observation" | "subagent";
interface TimelineItemData {
    id: string;
    status: EventStatus;
    content: ReactNode;
    /**
     * When true, the parent Timeline does not apply the running-state
     * gradient wash to this row's content cell. Use for rows that own a
     * nested timeline (e.g. subagents) — the wash bleeds behind the entire
     * expanded body and reads as a card around the group.
     */
    bare?: boolean;
    /**
     * Semantic kind of this row. Drives adjacency-aware vertical spacing
     * (consecutive thoughts pack tighter; tool/subagent boundaries breathe
     * wider) and the StatusBadge marker variant (subagent gets a ring).
     */
    kind?: TimelineItemKind;
}
interface TimelineProps {
    items: TimelineItemData[];
    badgeSize?: number;
    className?: string;
}
/**
 * Vertical timeline — refreshed look.
 *
 * One unbroken hairline rail down the badge column with rail-anchored ink
 * markers. The active segment carries a soft downward-flowing gradient
 * slice; running rows get a left-anchored gradient wash on the content
 * side. Spacing varies by adjacency so the panel reads like prose, not a
 * uniform list.
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
 * Single timeline item (alternative API). Matches the refreshed look of
 * the parent `Timeline`: hairline rail, ink-dot markers, no card chrome.
 */
declare function TimelineItem({ status, isLast, badgeSize, children, className, }: TimelineItemProps): react_jsx_runtime.JSX.Element;

interface StatusBadgeProps {
    status: EventStatus;
    size?: number;
    className?: string;
    /**
     * Semantic kind of the row this badge marks. Each kind has a distinct
     * marker geometry so the rail itself encodes event type at a glance —
     * dot for thoughts (soft/prose), diamond for tool calls (geometric/
     * action), ring for subagents (a dispatched thread). Shape, not just
     * color, carries the categorical distinction.
     */
    kind?: TimelineItemKind;
}
/**
 * Rail-anchored state marker.
 *
 * Shape carries state alongside color: running markers are visibly larger
 * with a strong breathing halo, so a neutral activity color still reads
 * as "in progress." Color comes from `--chat-activity` with a fallback to
 * `--chat-primary`; callers whose primary is neutral can override the
 * activity accent independently via `BrandingData.activityAccentColor`.
 */
declare function StatusBadge({ status, size, className, kind }: StatusBadgeProps): react_jsx_runtime.JSX.Element;

interface TimelineRowProps {
    /** Primary label — subtask description, agent name, or humanized handle. */
    label: string;
    /** Secondary text — task summary, self-description, or error message. */
    description?: string;
    /** Duration in seconds. Rendered right-aligned with tabular numerals. */
    durationSeconds?: number;
    /** Apply failed-state coloring to label/description. */
    isFailed?: boolean;
    /** Auto-expand the row when first rendered (e.g. when running). */
    defaultExpanded?: boolean;
    /** Nested events rendered in an indented body when expanded. */
    nestedEvents?: Event[];
    /** When true, the chevron is suppressed (used for non-expandable rows). */
    hideChevron?: boolean;
}
/**
 * Shared row content used by every reasoning-panel timeline:
 * plan subtasks, multi-agent subagents, and sub-assistant dispatches.
 *
 * The leading status marker and rail are provided by the parent
 * `Timeline`; this component only owns the label/description/duration row
 * and the nested timeline that expands beneath it.
 *
 * Refreshed look: the lucide chevron is replaced by a typographic caret
 * that rotates on expand; the duration is rendered as a tabular-num pill
 * with quiet weight so it reads as data, not chrome.
 */
declare function TimelineRow({ label, description, durationSeconds, isFailed, defaultExpanded, nestedEvents, hideChevron, }: TimelineRowProps): react_jsx_runtime.JSX.Element;

export { type ApprovalButtonSlotProps, type ApprovalChatInputSlotProps, ArtifactChunkData, type ArtifactEntry, ArtifactInlineCard, type ArtifactInlineCardProps, ArtifactList, type ArtifactListProps, Attachment, CardVisualization, type CardVisualizationProps, ChartVisualization, type ChartVisualizationProps, ChatHeader, type ChatHeaderAction, type ChatHeaderProps, CitationSources, type CitationSourcesProps, ClarificationData, ClarificationPanel, type ClarificationPanelProps, CodePreviewVisualization, type CodePreviewVisualizationProps, Event, EventContent, EventStatus, EventTimeline, type EventTimelineProps, FormVisualization, type FormVisualizationProps, InlineCitation, type InlineCitationProps, KpiVisualization, type KpiVisualizationProps, LoadingDots, type LoadingDotsProps, MediaChunkData, MessageAttachments, type MessageAttachmentsProps, PlanData, PlanTimeline, type PlanTimelineProps, ReasoningPanel, type ReasoningPanelProps, SourceDetailModal, type SourceDetailModalProps, SourceReference, StatusBadge, StreamingChunk, SubagentPanel, type SubagentPanelProps, TableVisualization, type TableVisualizationProps, TimeMarker, type TimeMarkerProps, Timeline, TimelineItem, type TimelineItemData, type TimelineItemProps, type TimelineProps, TimelineRow, type TimelineRowProps, ToolApprovalPanel, type ToolApprovalPanelProps, type ToolApprovalSlots, VisualizationActionEvent, VisualizationChunkData, VisualizationConfig, type VisualizationEntry, VisualizationRenderer, type VisualizationRendererProps, cardVisualizationSchema, chartVisualizationSchema, codePreviewVisualizationSchema, convertChunkToEvent, convertTimelineToEvents, formVisualizationSchema, getArtifact, getRegisteredArtifactTypes, getRegisteredTypes, getVisualization, kpiVisualizationSchema, registerArtifact, registerVisualization, tableVisualizationSchema };
