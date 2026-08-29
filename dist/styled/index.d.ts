export { A as AttachmentPreview, j as AttachmentPreviewProps, a as Avatar, k as AvatarProps, C as ChatContainer, l as ChatContainerProps, b as ChatLayout, m as ChatLayoutProps, M as MarkdownContent, n as MarkdownContentProps, c as Message, d as MessageActionBar, o as MessageActionBarProps, e as MessageComposer, p as MessageComposerProps, f as MessageList, q as MessageListProps, r as MessageProps, S as ScrollToBottomButton, s as ScrollToBottomButtonProps, g as StreamingText, t as StreamingTextProps, h as SuggestedActions, u as SuggestedActionsProps, v as ToolStatus, T as ToolStatusIndicator, w as ToolStatusIndicatorProps, i as TypingIndicator, x as TypingIndicatorProps, W as WelcomeScreen, y as WelcomeScreenProps } from '../WelcomeScreen-DLL8JTDR.js';
import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import react__default, { ReactNode, ComponentType } from 'react';
import { A as Attachment, S as SourceReference } from '../message-DTNTKSQr.js';
export { C as ChatMessage, M as MessageData, a as MessageError, b as Participant, P as ParticipantRole, c as SourceTypeConfig, d as SuggestedAction, e as SuggestedActionType } from '../message-DTNTKSQr.js';
import { S as StreamingChunk, P as PlanData, f as SubagentChunkData, C as ClarificationData, a as ClarificationAnswer, T as ToolApprovalData, V as VisualizationChunkData, g as VisualizationActionEvent, M as MediaChunkData, h as ChartVisualizationData, i as VisualizationConfig, j as TableVisualizationData, k as CardVisualizationData, K as KpiVisualizationData, l as CodePreviewVisualizationData, F as FormVisualizationData, m as AuthPromptVisualizationData, A as ArtifactChunkData, E as Event, n as EventStatus } from '../streaming-BfLEgW5u.js';
export { o as ArtifactStatus, p as ChunkType, q as EventType, r as FollowupAction, O as ObservationEvent, s as PlanningEvent, t as ProgressData, u as StreamingMessage, v as SubTaskData, w as SubtaskEvent, x as ThinkingEvent, y as ToolEvent, z as VisualizationType } from '../streaming-BfLEgW5u.js';
import { z, ZodSchema } from 'zod';
export { ChatContextValue, ChatProvider, ChatProviderProps, useChatContext } from '../context/index.js';
export { B as BrandingData } from '../branding-NieTEGQf.js';
export { u as useComposer, g as useMessage } from '../avatar-B_AvYfE8.js';
import '../types-Du00UBst.js';

/**
 * Bottom toolbar row for composers: attach button, an Enter-to-send hint that
 * fades in while the composer is focused (requires `group` on the shell), and
 * a trailing slot for the send/stop button.
 */
declare function ComposerToolbar({ onAttachClick, disabled, hint, showHint, endSlot, className, }: {
    /** Renders the "+" attach button when provided. */
    onAttachClick?: () => void;
    disabled?: boolean;
    /** Keyboard hint shown while focused. Pass showHint={false} to hide. */
    hint?: string;
    showHint?: boolean;
    /** Send / stop button. */
    endSlot?: ReactNode;
    className?: string;
}): react_jsx_runtime.JSX.Element;

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

/**
 * One frame of the decode: everything left of the wavefront is settled, the
 * rest is noise.
 *
 * Pure, and exported, because it is the only part of this component with logic
 * worth checking and the effect that drives it runs too fast to catch from the
 * outside — a screenshot or a MutationObserver both arrive after it has landed.
 *
 * @param progress 0 → all noise, 1 → the real text.
 * @param frame    Increments per roll so the unresolved tail churns instead of
 *                 freezing on one arrangement between settles.
 */
declare function decodeFrame(text: string, progress: number, frame: number): string;
interface ThinkingIndicatorProps {
    /**
     * Brand mark shown while the agent starts up. Supplied by the host, which
     * owns its own logo and its own image loader; this package renders the
     * motion around whatever it is given. Omit it for the plain form.
     */
    mark?: ReactNode;
    /** Status line, e.g. "Getting started…". Resolves out of noise. */
    label?: string | null;
    className?: string;
}
/**
 * The waiting state before the first token.
 *
 * A mark with a breathing halo, beside a line of text decoding itself. Both
 * halves are the same idea: something is being worked out, and it is nearly
 * here.
 */
declare function ThinkingIndicator({ mark, label, className }: ThinkingIndicatorProps): react_jsx_runtime.JSX.Element;

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
    /** Which edge to align against — "end" for the viewer's own right-aligned
     *  messages, so a thumbnail narrower than the bubble doesn't drift left. */
    align?: "start" | "end";
    /** Additional class names */
    className?: string;
}
/**
 * Display attachments in messages: images render as inline thumbnails that open
 * a lightbox; everything else renders as a compact file chip.
 */
declare function MessageAttachments({ attachments, onDownload, onPreview, align, className, }: MessageAttachmentsProps): react_jsx_runtime.JSX.Element | null;

/**
 * @deprecated Superseded by `ReasoningStream`, which renders the agent's work as
 * steps in the transcript rather than as a timeline nested under a chip. This
 * component is no longer used by `Message`; it stays exported because
 * `@miiflow/assistant-ui` is published and external consumers may mount it
 * directly. Remove in the next major.
 *
 * Known limitations, kept as-is rather than fixed here: thinking rows are always
 * built with `status: "completed"`, so the live-state shimmer never fires on
 * them; and `convertChunkToEvent` never sets `durationSeconds`, so the per-step
 * duration trail never draws.
 */
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
    /** Epoch ms the in-progress run started. Supply the run's durable start so
     *  the live counter survives this panel remounting; omit to time from mount. */
    streamStartedAt?: number;
    /** Whether expanded by default */
    defaultExpanded?: boolean;
    /** Controlled expanded state */
    expanded?: boolean;
    /** Callback when expanded state changes */
    onExpandedChange?: (expanded: boolean) => void;
    /** Additional class names */
    className?: string;
}
declare function ReasoningPanel({ isStreaming, chunks, plan, executionTimeline, userMessageTimestamp, executionTime, streamStartedAt, defaultExpanded, expanded: controlledExpanded, onExpandedChange, className, }: ReasoningPanelProps): react_jsx_runtime.JSX.Element | null;

interface ReasoningStreamProps {
    /** Whether the run is still producing steps. */
    isStreaming?: boolean;
    /** The turn's reasoning chunks, live or replayed from the durable trace. */
    chunks?: StreamingChunk[];
    /** Persisted wall clock for the whole run, in seconds. */
    executionTime?: number;
    /**
     * Epoch ms the in-progress run started. Supply the run's durable start so the
     * live counter survives this component remounting — timing from mount
     * restarts at 0 on a run that is already minutes old.
     */
    streamStartedAt?: number;
    /**
     * The run finished moments ago, in a DIFFERENT component instance.
     *
     * The streaming message and the completed message are separate elements, so
     * this component cannot observe the streaming→complete edge itself. The host
     * passes it instead, and it is what turns the collapse from a jump cut into
     * a transition.
     */
    justCompleted?: boolean;
    /** Controlled disclosure of the finished turn's full trace. */
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    className?: string;
}
/**
 * The agent's work, rendered as steps in the transcript.
 *
 * Live, it is a rolling window of the last few steps — the newest at full
 * strength, older ones fading out above. A long run therefore costs a fixed
 * amount of vertical space instead of pushing the composer off the screen.
 *
 * Finished, it collapses to one line: `Thought for 2:14 · 6 steps`, which
 * re-opens to the full trace on click.
 */
declare function ReasoningStream({ isStreaming, chunks, executionTime, streamStartedAt, justCompleted, expanded: controlledExpanded, onExpandedChange, className, }: ReasoningStreamProps): react_jsx_runtime.JSX.Element | null;

type RunStepStatus = "pending" | "running" | "completed" | "failed";
/**
 * What a tool call DID, as declared server-side.
 *
 * Three values, not a richer taxonomy, because three is what the wire actually
 * knows. `undeclared` is a first-class answer: a tool that never said whether
 * it has side effects must not be drawn as a read, since that is the one
 * mistake with consequences for the person watching.
 */
type RunStepToolKind = "read" | "write" | "undeclared";
/**
 * One tool call, rendered as an inline chip inside the thought that justified it.
 */
interface RunStepTool {
    /** Provider tool-call id when available; otherwise a positional fallback. */
    id: string;
    /** Raw slug (`get_ad_performance`) — the hover title. */
    name: string;
    /** LLM-written prose, falling back to the slug. */
    label: string;
    /** True when `label` is only the slug, so it can render as an identifier. */
    isSlugOnly: boolean;
    /** Read, write, or undeclared. Drives the mark and the chip's weight. */
    kind: RunStepToolKind;
    status: RunStepStatus;
    /** Epoch ms. `endedAt` is undefined while the call is still open. */
    startedAt?: number;
    endedAt?: number;
    /** Bounded excerpt of a failed result, surfaced when the step is expanded. */
    observationExcerpt?: string;
}
/**
 * One unit of the transcript: a thought plus the tool calls it justified.
 *
 * The agent thinks, then acts, so a tool belongs to the thought immediately
 * preceding it. That is the same boundary the server's `RunTraceProjector`
 * already draws (`_finish_open_thinking` closes the open thought the moment a
 * tool arrives), which is why the grouping needs no extra signal on the wire.
 *
 * A `subagent` step is block-level rather than a chip — a dispatched thread is
 * not a chip — and carries no prose of its own.
 */
interface RunStep {
    id: string;
    sequence: number;
    kind: "thinking" | "planning" | "subagent";
    status: RunStepStatus;
    /** Markdown prose. Absent when tools ran with no preceding thought. */
    text?: string;
    tools: RunStepTool[];
    /** Epoch ms. `endedAt` is undefined while the step is still open. */
    startedAt?: number;
    endedAt?: number;
    /**
     * The specialists this step dispatched. Always at least one on a `subagent`
     * step, empty otherwise.
     *
     * A LIST rather than a single value because `dispatch_assistant` is
     * parallelizable: one parent step can gather several children, and showing
     * them as separate stacked steps loses the fact that they ran at once. Only
     * dispatches sharing a `dispatchStep` are collected here.
     */
    subagents: SubagentChunkData[];
}

interface StepBlockProps {
    step: RunStep;
    /** Older step in the live window: quieter, and never the shimmering one. */
    dimmed?: boolean;
    /** Animate an entrance. False for steps already on screen (a replayed
     *  trace must not perform, and re-opening one must not re-animate). */
    entering?: boolean;
    /** Delay in ms, for staggering a revealed trace. */
    enterDelayMs?: number;
}
/**
 * One step of the transcript: a mark, then prose, with the tool calls it
 * justified flowing inline underneath.
 *
 * Every step type sits in the same two-column shape — mark gutter, content —
 * so a thought and a dispatched specialist read as members of one sequence.
 * The specialist used to wear a 24px initials badge instead, which made it a
 * different kind of object on the page and spelled out "GA" to no one's
 * benefit.
 *
 * There is deliberately no rule connecting the marks. A rail would turn this
 * back into the trace viewer the redesign replaced; the shared x-position is
 * enough to read as a column.
 */
declare function StepBlock({ step, dimmed, entering, enterDelayMs, }: StepBlockProps): react_jsx_runtime.JSX.Element | null;

/**
 * One tool call, inline in the flow of the thought that justified it.
 *
 * ## Two states, not three
 *
 * Only a declared WRITE is marked. Reads and undeclared tools share one quiet
 * treatment, because both are honestly described by "nothing notable happened
 * here" — and because a mark per category produced a row of competing glyphs
 * that said nothing. Every run that predates the `writes` declaration reaching
 * the wire has no declaration at all, so a distinct "unknown" mark would have
 * stamped a loud diamond on the entire history for a signal with no content.
 *
 * ## Why there is no border
 *
 * A 1px outline plus an internal divider made these read as broken form
 * controls at 12px. A soft fill with no edge is one shape instead of three,
 * which is what lets a paragraph carry four of them without looking like a
 * toolbar. The duration recedes inside the same shape rather than sitting in a
 * compartment of its own.
 */
declare function ToolChip({ tool }: {
    tool: RunStepTool;
}): react_jsx_runtime.JSX.Element;

/**
 * Turn an LLM-facing handle ("google_ads_specialist") into a human label
 * ("Google Ads Specialist").
 */
declare function humanizeHandle(handle: string): string;
/**
 * Monogram for the avatar: "Google Ads Specialist" → "GA", "Budget
 * Specialist" → "BU".
 *
 * The role noun is dropped because the distinguishing part of a handle is what
 * comes BEFORE it — every specialist would otherwise collapse toward "…S". A
 * handle with only one meaningful word takes two letters of it rather than
 * standing as a lone initial, which reads as a stray character at 24px.
 */
declare function initials(handle: string): string;
/**
 * The nested work one specialist did: its steps, its tool chips, its answer.
 *
 * Body only — the header, the status and the disclosure belong to
 * `SubagentGroup`, which renders them the same way whether the parent step
 * dispatched one specialist or gathered five. Splitting them is what stops the
 * single-dispatch case being a second implementation of the group.
 */
declare function SubagentBody({ data }: {
    data: SubagentChunkData;
}): react_jsx_runtime.JSX.Element;

interface SubagentGroupProps {
    /** One dispatch, or several gathered from the same parent step. */
    members: SubagentChunkData[];
}
/**
 * A dispatch: one specialist, or several that ran at once.
 *
 * `dispatch_assistant` is parallelizable, so a parent step can gather three
 * specialists that work simultaneously. Rendered as three stacked rows that
 * reads as three things that happened in sequence, which is the one fact the
 * layout should not get wrong. A pip row says "these ran together" in the space
 * of one line, and the ring around each pip says which are still going.
 *
 * The pips are deliberately identical. Nothing in the data distinguishes one
 * specialist from another at a glance — the handle is a user-editable slug with
 * no platform link, and initials spell out letters nobody reads. So the group
 * carries COUNT and STATUS, and the tab row underneath carries identity.
 */
declare function SubagentGroup({ members }: SubagentGroupProps): react_jsx_runtime.JSX.Element;

/**
 * Marks for the reasoning stream.
 *
 * Two levels, and only two. STEPS carry a mark so the left edge reads as one
 * consistent column; CHIPS carry one only when the tool changed something. An
 * icon on every chip turned a row of three tool calls into a row of three
 * competing glyphs and said nothing, since almost every call is a read.
 *
 * Drawn at 12-13px, where stroke detail disappears, so the solid marks are
 * filled silhouettes rather than line art.
 */
interface MarkProps {
    size?: number;
}
/**
 * A STEP the agent reasoned through. Three lines of decreasing width — a note,
 * not a bullet. Quiet enough to sit beside prose without competing with it, and
 * specific enough that the gutter reads as a deliberate column rather than an
 * indent.
 */
declare function StepMark({ size }: MarkProps): react_jsx_runtime.JSX.Element;
/**
 * A WRITE: the agent changed something on a live account.
 *
 * A pencil, because that is the mark Google Ads and Meta Ads Manager both use
 * for editing a campaign — this audience already reads it as "this modified
 * something", with no translation. It is the ONLY mark a chip ever carries, so
 * a single change stands out in a paragraph full of reads.
 */
declare function WriteMark({ size }: MarkProps): react_jsx_runtime.JSX.Element;
/**
 * An AGENT: one specialist, as it appears in a dispatch's pip row.
 *
 * A robot head, drawn geometrically rather than cartoonishly — square-ish
 * proportions, tight eyes, no mouth. It stands for the colleague doing the
 * work, which is what a pip needs to say; the STEP that dispatched it keeps
 * `DispatchMark`, because a step is a delegation, not a robot.
 *
 * The eyes are knocked out of the head with `fill-rule="evenodd"` rather than
 * painted in a background colour: this package has no surface token, so a
 * filled counter-shape would be wrong on any host that is not white.
 */
declare function AgentMark({ size }: MarkProps): react_jsx_runtime.JSX.Element;
/**
 * A DISPATCH: the STEP in which the agent handed work to specialists.
 *
 * One node branching into two — the shape of the delegation itself, not of the
 * colleague doing it. This marks a sub-agent step in the same gutter a
 * thought's mark sits in, which is what makes the two read as members of one
 * sequence. Who is doing the work is said by the pips (`AgentMark`), a level
 * down; the two glyphs answer different questions and both are needed.
 */
declare function DispatchMark({ size }: MarkProps): react_jsx_runtime.JSX.Element;
/** Disclosure chevron. Rotates 90° on open. */
declare function Chevron({ size }: MarkProps): react_jsx_runtime.JSX.Element;
/**
 * Three bars reading as a level meter: "this is working right now".
 *
 * The one live affordance in the panel, shared by the run footer and by a
 * dispatched specialist so both say it the same way.
 *
 * Still, under reduced motion, it holds the stepped shape the animation passes
 * through, so the row keeps its in-progress reading without moving.
 */
declare function ActivityMeter({ reducedMotion, size, }: {
    reducedMotion?: boolean;
    size?: number;
}): react_jsx_runtime.JSX.Element;

/**
 * Tools that are machinery rather than work the user asked for.
 *
 * `dispatch_assistant` is the odd one: the call IS user-relevant, but it
 * arrives a second time as a `subagent` chunk carrying the child's whole
 * thread, and that is the rendering we want — so the bare tool row is dropped
 * to avoid showing one dispatch twice.
 *
 * This is the ONLY copy. `ReasoningPanel`, `EventTimeline` and `PlanTimeline`
 * each kept their own, which is how they drifted apart.
 */
declare const INTERNAL_TOOLS: Set<string>;
declare function isInternalTool(toolName?: string): boolean;
/**
 * Group a flat chunk stream into the steps the transcript renders.
 *
 * The one grouping rule, applied to every source: a step opens on a thought (or
 * on a tool with no thought before it) and closes when the next thought or
 * sub-agent dispatch arrives. Both producers — the live SSE reducers and
 * `runTraceStepsToChunks` replaying a durable trace — hand over the same chunk
 * shape, so both get the same result and a reloaded thread looks like the run
 * the user watched.
 *
 * `isStreaming` decides only whether the trailing step may render as running:
 * on a finished run nothing is open, however the last chunk happened to look.
 */
declare function buildRunSteps(chunks: readonly StreamingChunk[] | undefined, isStreaming?: boolean): RunStep[];
/** Seconds between two epoch-ms stamps, or undefined when either is missing. */
declare function durationSeconds(startedAt?: number, endedAt?: number): number | undefined;
/** Total wall clock the steps span, for the collapsed summary line. */
declare function stepsWallClockSeconds(steps: readonly RunStep[]): number | undefined;

interface ClarificationPanelProps {
    clarification: ClarificationData;
    /**
     * Called on submit with both the human-readable text (for the transcript) AND
     * the structured per-question answers (for deterministic server-side capture —
     * no parsing of the text).
     */
    onSubmit?: (response: string, answers: ClarificationAnswer[]) => void;
    /** Best-effort callback fired when an option is selected (legacy hook). */
    onOptionSelect?: (option: string) => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    /**
     * When set, renders a read-only "answered" state showing the user's response
     * inline. Used in scrolled-back chat history so a past clarification still
     * shows what was answered.
     */
    answer?: string;
}
/**
 * Clarification panel — displays when the agent needs the user to pick from
 * one or more multiple-choice questions. Orange left-border panel.
 *
 * If `answer` is provided, switches to a read-only "answered" view.
 */
declare function ClarificationPanel({ clarification, onSubmit, onOptionSelect, disabled, loading, className, answer, }: ClarificationPanelProps): react_jsx_runtime.JSX.Element | null;

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
 * Tool approval — rendered as a raised CTA above the composer to communicate
 * that the agent is paused on a decision. Anatomy:
 *
 *   ┌─ Approve action ─ <tool identity> ─────────────────────┐
 *   │  <agent's prompt sentence>                              │
 *   │  [param: value]  [param: value]                         │
 *   │  [ Approve ]  [ Decline ]    ⏎ approve · Esc decline    │
 *   │  Show all details                                       │
 *   └─────────────────────────────────────────────────────────┘
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
declare function SourceDetailModal({ source, onClose, }: SourceDetailModalProps): react.ReactPortal | null;
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
declare const authPromptVisualizationSchema: z.ZodObject<{
    providerName: z.ZodString;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provider: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    providerLogo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    serviceProviderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mcpServerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    mcpServerName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    authMethods: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        authType: z.ZodString;
    }, z.core.$strip>>>>;
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

interface AuthPromptVisualizationProps {
    data: AuthPromptVisualizationData;
    config?: VisualizationConfig;
    isStreaming?: boolean;
    onAction?: (event: VisualizationActionEvent) => void;
}
/**
 * "Connect your account" card for an integration the assistant could not use.
 *
 * This is the PACKAGE-level renderer, and it is deliberately presentational:
 * running the OAuth flow needs the host's session, GraphQL client and popup
 * plumbing, none of which belong here (see the styled/ agnosticism rule). A
 * host that can connect passes `onAction`; the app's MUI override in
 * `web/components/assistants/chat/visualizations/` replaces this entirely.
 *
 * It exists because a registered *fallback* is what separates a degraded render
 * from a broken one. Every other visualization type had one; `auth_prompt` was
 * contributed only by the host's registration module, so when a production
 * build elided that module the card rendered as the literal text "Unknown
 * visualization type: auth_prompt" in users' threads (2026-08-02).
 *
 * Without `onAction` there is nothing a button could do, so none is drawn — a
 * dead Connect button reads as a broken feature rather than a missing one.
 */
declare function AuthPromptVisualization({ data, onAction, }: AuthPromptVisualizationProps): react_jsx_runtime.JSX.Element;

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
 *
 * @deprecated Never called. It was the only producer of `durationSeconds`, and
 * `ReasoningPanel` built its events with `convertChunkToEvent` instead — which
 * is why that panel's duration trail never drew. Per-step timing now travels on
 * `StreamingChunk.startedAt` / `endedAt`; see `reasoning/build-steps.ts`.
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

export { ActivityMeter, AgentMark, type ApprovalButtonSlotProps, type ApprovalChatInputSlotProps, ArtifactChunkData, type ArtifactEntry, ArtifactInlineCard, type ArtifactInlineCardProps, ArtifactList, type ArtifactListProps, Attachment, AuthPromptVisualization, type AuthPromptVisualizationProps, CardVisualization, type CardVisualizationProps, ChartVisualization, type ChartVisualizationProps, ChatHeader, type ChatHeaderAction, type ChatHeaderProps, Chevron, CitationSources, type CitationSourcesProps, ClarificationData, ClarificationPanel, type ClarificationPanelProps, CodePreviewVisualization, type CodePreviewVisualizationProps, ComposerToolbar, DispatchMark, Event, EventContent, EventStatus, EventTimeline, type EventTimelineProps, FormVisualization, type FormVisualizationProps, INTERNAL_TOOLS, InlineCitation, type InlineCitationProps, KpiVisualization, type KpiVisualizationProps, LoadingDots, type LoadingDotsProps, MediaChunkData, MessageAttachments, type MessageAttachmentsProps, PlanData, PlanTimeline, type PlanTimelineProps, ReasoningPanel, type ReasoningPanelProps, ReasoningStream, type ReasoningStreamProps, type RunStep, type RunStepStatus, type RunStepTool, type RunStepToolKind, SourceDetailModal, type SourceDetailModalProps, SourceReference, StatusBadge, StepBlock, type StepBlockProps, StepMark, StreamingChunk, SubagentBody, SubagentChunkData, SubagentGroup, type SubagentGroupProps, SubagentPanel, type SubagentPanelProps, TableVisualization, type TableVisualizationProps, ThinkingIndicator, type ThinkingIndicatorProps, TimeMarker, type TimeMarkerProps, Timeline, TimelineItem, type TimelineItemData, type TimelineItemProps, type TimelineProps, TimelineRow, type TimelineRowProps, ToolApprovalPanel, type ToolApprovalPanelProps, type ToolApprovalSlots, ToolChip, VisualizationActionEvent, VisualizationChunkData, VisualizationConfig, type VisualizationEntry, VisualizationRenderer, type VisualizationRendererProps, WriteMark, authPromptVisualizationSchema, buildRunSteps, cardVisualizationSchema, chartVisualizationSchema, codePreviewVisualizationSchema, convertChunkToEvent, convertTimelineToEvents, decodeFrame, durationSeconds, formVisualizationSchema, getArtifact, getRegisteredArtifactTypes, getRegisteredTypes, getVisualization, humanizeHandle, initials, isInternalTool, kpiVisualizationSchema, registerArtifact, registerVisualization, stepsWallClockSeconds, tableVisualizationSchema };
