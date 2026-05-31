/**
 * Types for streaming message handling.
 */

export interface StreamingState {
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamedContent: string;
}

export interface StreamChunk {
  type: "content" | "reasoning" | "tool_call" | "done" | "error";
  content?: string;
  messageId?: string;
  error?: string;
}

export interface StreamingOptions {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (finalContent: string) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Advanced Streaming Types (for ReAct and Plan & Execute modes)
// ============================================================================

/**
 * Extended chunk types for agentic streaming.
 *
 * `subtask` / `progress` / structured `planning` chunks are retained for
 * historical messages persisted before the unified-ReAct migration. New
 * streams emit `planning` only as plain text (enter_plan_mode / exit_plan_mode)
 * and route sub-agent work through the `subagent` chunk type.
 */
export type ChunkType =
  | "content"         // Regular content
  | "thinking"        // ReAct reasoning
  | "tool"            // Tool planned/executing
  | "observation"     // Tool result
  | "answer"          // Final answer
  | "planning"        // enter_plan_mode / exit_plan_mode chunk (historical: structured plan)
  | "subtask"         // Subtask execution (historical Plan & Execute)
  | "progress"        // Progress update
  // Clarification request
  | "clarification_needed"          // Agent needs user input to continue
  // Tool approval request
  | "tool_approval_needed"          // Tool requires user approval before execution
  // Visualization
  | "visualization"   // Rich visualization (chart, table, card, etc.)
  // Media (inline image/video/audio)
  | "media"           // Inline media from image generation tools
  // Artifact (downloadable PDF / HTML produced by a tool)
  | "artifact"        // Persisted artifact with side-panel viewer
  // Sub-assistant rendering (nested SubagentPanel)
  | "subagent"        // Nested subagent execution (dispatch_assistant tool)
  // Suggested action (inline recommendation card)
  | "suggested_action_created"; // Agent recommended an action

/**
 * Subtask data structure for Plan & Execute mode
 */
export interface SubTaskData {
  id: number;
  description: string;
  required_tools?: string[];
  dependencies?: number[];
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  execution_time?: number;
}

/**
 * Plan data structure for Plan & Execute mode
 */
export interface PlanData {
  subtasks: SubTaskData[];
  goal: string;
  reasoning: string;
  total_subtasks: number;
  completed_subtasks: number;
  failed_subtasks: number;
  progress_percentage: number;
}

/**
 * Progress data for streaming updates
 */
export interface ProgressData {
  completed: number;
  failed?: number;
  total: number;
  percentage: number;
  waveNumber?: number;
}

// ============================================================================
// Sub-Assistant Chunk Type (nested rendering)
// ============================================================================

export interface SubagentChunkData {
  subagentId: string;
  subagentType: string;
  prompt?: string;
  status: "running" | "completed" | "failed";
  result?: string;
  durationMs?: number;
  nestedChunks: StreamingChunk[];
}

export interface ClarificationQuestion {
  question: string;
  options: string[];
  /** When true the user may pick several options (checkboxes). */
  multiSelect?: boolean;
}

export interface ClarificationData {
  /** Multiple-choice questions to put to the user (current shape). */
  questions?: ClarificationQuestion[];
  context?: string;
  /** @deprecated legacy single-question text, kept for rendering old history. */
  question?: string;
  /** @deprecated legacy single-question options. */
  options?: string[];
  /** @deprecated legacy free-text flag, no longer emitted. */
  allowFreeText?: boolean;
  subtaskId?: number;
  subtaskDescription?: string;
  subagentName?: string;
  subagentRole?: string;
  // Tool call ID from the orchestrator for proper tool observation flow
  toolCallId?: string;
}

export interface ToolApprovalData {
  toolName: string;
  toolDescription: string;
  toolInputs: Record<string, unknown>;
  toolSchema?: Record<string, unknown>;
  toolCallId?: string;
  /** Human-readable tool identity surfaced in the approval eyebrow (e.g. "Yahoo Finance · Stock Basic Info"). Falls back to toolName when omitted. */
  toolLabel?: string;
}

// ============================================================================
// Visualization Types
// ============================================================================

export type VisualizationType =
  | "chart"
  | "table"
  | "card"
  | "kpi"
  | "code_preview"
  | "form";

export type ChartDataType = "line" | "bar" | "pie" | "area" | "scatter" | "composed";

export interface ChartSeries {
  name: string;
  data: Array<{ x: string | number; y: number } | { name: string; value: number }>;
  color?: string;
}

export interface ChartAxis {
  label?: string;
  type?: "category" | "number" | "time";
  min?: number;
  max?: number;
}

export interface ChartVisualizationData {
  chartType: ChartDataType;
  series: ChartSeries[];
  xAxis?: ChartAxis;
  yAxis?: ChartAxis;
}

export type TableColumnType =
  | "string"
  | "number"
  | "currency"
  | "date"
  | "badge"
  | "link"
  | "boolean"
  | "progress"
  | "media";

export interface TableColumn {
  key: string;
  label: string;
  type?: TableColumnType;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface TableVisualizationData {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

export interface CardSection {
  title?: string;
  items?: Array<{ label: string; value: string | number }>;
  content?: string;
}

export interface CardAction {
  label: string;
  action: string;
  variant?: "primary" | "secondary" | "text";
}

export interface CardVisualizationData {
  subtitle?: string;
  imageUrl?: string;
  sections: CardSection[];
  actions?: CardAction[];
}

export interface KpiMetric {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  change?: string | number;
  changeLabel?: string;
  sparkline?: number[];
  color?: string;
  // Bento layout only: marks the hero card. If unset, the first metric is hero.
  prominence?: "primary" | "secondary";
}

export interface KpiVisualizationData {
  metrics: KpiMetric[];
  layout?: "row" | "grid" | "bento";
}

export interface CodePreviewVisualizationData {
  code: string;
  language: string;
  lineNumbers?: boolean;
  highlightLines?: number[];
  startLine?: number;
}

export type FormFieldType =
  | "text"
  | "number"
  | "email"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio"
  | "textarea"
  | "date"
  | "datetime";

export interface FormField {
  name: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormVisualizationData {
  fields: FormField[];
  submitAction?: string;
}

export interface VisualizationConfig {
  height?: number;
  width?: string;
  colors?: string[];
  legend?: boolean;
  grid?: boolean;
  tooltip?: boolean;
  animate?: boolean;
  stacked?: boolean;
  sortable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  filterable?: boolean;
  selectable?: boolean;
  collapsible?: boolean;
  initiallyCollapsed?: boolean;
  submitButtonText?: string;
  cancelButtonText?: string;
}

export interface VisualizationData {
  id: string;
  /** Built-in type or any custom type registered via `registerVisualization()`. */
  type: VisualizationType | (string & {});
  title?: string;
  description?: string;
  data:
    | ChartVisualizationData
    | TableVisualizationData
    | CardVisualizationData
    | KpiVisualizationData
    | CodePreviewVisualizationData
    | FormVisualizationData
    | Record<string, unknown>;
  config?: VisualizationConfig;
}

export interface VisualizationChunkData extends VisualizationData {
  context?: {
    orchestratorType?: string;
    toolName?: string;
    subtaskId?: number;
    subagentName?: string;
  };
}

export interface MediaChunkData {
  id: string;
  url: string;
  mediaType: string; // "image", "video", "audio"
  altText?: string;
  context?: {
    orchestratorType?: string;
    toolName?: string;
  };
}

/**
 * Artifact chunk — a tool-produced file (PDF, HTML, ...) persisted server-side.
 *
 * The backend emits the chunk twice per artifact: first with
 * `status: "pending"` (before rendering) so the frontend can show a skeleton
 * card, then again with `status: "ready"` (URL + size populated) or
 * `status: "failed"` (errorMessage populated). Consumers should key by `id`
 * and replace state on the second chunk.
 *
 * `url` is a stable proxy URL (`/assistant/artifacts/<id>/download/`) — the
 * backend re-signs on every request, so it does not expire mid-session. It is
 * `null` while status is pending/failed.
 */
export type ArtifactStatus = "pending" | "ready" | "failed";

export interface ArtifactChunkData {
  id: string;
  kind: "pdf" | "html" | string;
  title: string;
  description?: string;
  status?: ArtifactStatus;
  url: string | null;
  mimetype?: string;
  sizeBytes?: number;
  pageCount?: number;
  createdAt?: string;
  errorMessage?: string;
  context?: {
    orchestratorType?: string;
    toolName?: string;
  };
}

/**
 * Extended streaming chunk with full agentic support
 */
export interface StreamingChunk {
  type: ChunkType;
  content: string;

  // Tool-related (ReAct)
  toolName?: string;
  toolDescription?: string;
  toolArgs?: Record<string, unknown>;
  success?: boolean;
  status?: "planned" | "executing" | "completed";

  // Historical Plan & Execute fields (kept for replaying pre-migration messages)
  subtaskId?: number;
  sequence?: number;
  subtaskData?: SubTaskData;
  planData?: PlanData;
  progress?: ProgressData;

  // Orchestrator context (for nested execution)
  orchestrator?: "react" | "plan_execute";
  parentSubtaskId?: number;

  // Sub-assistant nested rendering
  subagentData?: SubagentChunkData;
  clarificationData?: ClarificationData;
  toolApprovalData?: ToolApprovalData;
  visualizationData?: VisualizationChunkData;
  mediaData?: MediaChunkData;
  artifactData?: ArtifactChunkData;
  toolUseId?: string;
}

/**
 * Streaming message with chunks and metadata
 */
export interface StreamingMessage {
  id?: string;
  textContent: string;
  previousMessageId?: string;
  chunks?: StreamingChunk[];

  // Plan execution metadata
  orchestratorType?: "react" | "plan_execute";
  executionPlan?: PlanData;

  // Follow-up actions
  suggestedActions?: FollowupAction[];

  // Sub-assistant tracking
  activeSubagents?: Map<string, SubagentChunkData>;

  // Pending clarification
  pendingClarification?: ClarificationData;

  // Pending tool approval
  pendingToolApproval?: ToolApprovalData;

  // Visualizations
  visualizations?: VisualizationChunkData[];

  // Media (images, video, audio)
  medias?: MediaChunkData[];

  // Downloadable artifacts (PDF, HTML, ...)
  artifacts?: ArtifactChunkData[];
}

/**
 * Follow-up action suggested by AI
 */
export interface FollowupAction {
  label: string;
  action: string;
  type: "send_message" | "navigate" | "copy_text" | "compose_email" | "search_emails" | "open_modal" | "api_call";
  context: Record<string, unknown>;
}

// ============================================================================
// Event Timeline Types (for reasoning display)
// ============================================================================

export type EventStatus = "pending" | "running" | "completed" | "failed";

export type EventType =
  | "thinking"
  | "planning"
  | "tool"
  | "observation"
  | "subtask"
  | "subagent";

export interface BaseEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  timestamp?: number;
  /**
   * Elapsed wall-clock duration for this event in seconds. Populated by
   * `convertTimelineToEvents` from pairwise timeline timestamps; left
   * undefined for live streaming chunks (no per-chunk arrival time is
   * carried through the stream).
   */
  durationSeconds?: number;
}

export interface ThinkingEvent extends BaseEvent {
  type: "thinking";
  content: string;
}

export interface PlanningEvent extends BaseEvent {
  type: "planning";
  content: string;
  isComplete?: boolean;
}

export interface ToolEvent extends BaseEvent {
  type: "tool";
  toolName: string;
  toolDescription?: string;
  input?: unknown;
}

export interface ObservationEvent extends BaseEvent {
  type: "observation";
  toolName: string;
  content: string;
  success?: boolean;
}

export interface SubtaskEvent extends BaseEvent {
  type: "subtask";
  title: string;
  description?: string;
  executionTime?: number;
  result?: string;
  error?: string;
  children?: Event[];
}

/**
 * Sub-assistant dispatch event. Rendered inline in the parent's reasoning
 * timeline at the position the dispatch was issued. Carries the full
 * SubagentChunkData so the renderer can show name, status, and the
 * streaming result without a separate lookup.
 */
export interface SubagentEvent extends BaseEvent {
  type: "subagent";
  subagentData: SubagentChunkData;
}

export type Event =
  | ThinkingEvent
  | PlanningEvent
  | ToolEvent
  | ObservationEvent
  | SubtaskEvent
  | SubagentEvent;

// ============================================================================
// Visualization Action Event (interaction callbacks)
// ============================================================================

export type VisualizationActionEvent =
  | { type: "form_submit"; action: string; data: Record<string, unknown> }
  | { type: "form_cancel"; action: string }
  | { type: "card_action"; action: string };
