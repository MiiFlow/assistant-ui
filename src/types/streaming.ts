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
 * Extended chunk types for agentic streaming
 */
export type ChunkType =
  | "content"         // Regular content
  | "thinking"        // ReAct reasoning
  | "tool"            // Tool planned/executing
  | "observation"     // Tool result
  | "answer"          // Final answer
  | "planning"        // Plan creation (Plan & Execute)
  | "subtask"         // Subtask execution (Plan & Execute)
  | "progress"        // Progress update (Plan & Execute)
  // Parallel Plan execution (wave-based)
  | "wave_start"      // Start of parallel execution wave
  | "wave_complete"   // End of parallel execution wave
  | "parallel_subtask_start"    // Individual subtask in wave started
  | "parallel_subtask_complete" // Individual subtask in wave completed
  // Multi-Agent execution (miiflow-llm)
  | "multi_agent_planning"          // Lead agent planning subagents
  | "multi_agent_planning_complete" // Planning complete with subagent allocations
  | "subagent_start"                // Individual subagent started
  | "subagent_complete"             // Individual subagent completed
  | "subagent_failed"               // Individual subagent failed
  | "synthesis"                     // Synthesizing results from subagents
  // Clarification request
  | "clarification_needed"          // Agent needs user input to continue
  // Visualization
  | "visualization"   // Rich visualization (chart, table, card, etc.)
  // Claude SDK native chunk types
  | "subagent"        // Nested subagent execution
  | "file_operation"  // Read/Write/Edit file operations
  | "terminal"        // Bash command execution
  | "search_results"  // Glob/Grep search results
  | "web_operation"   // WebSearch/WebFetch operations
  | "claude_text"     // Claude SDK text output
  | "claude_thinking"; // Claude SDK extended thinking

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
// Parallel Execution Types (wave-based)
// ============================================================================

export interface WaveData {
  waveNumber: number;
  subtaskIds: number[];
  parallelCount: number;
  totalWaves: number;
  startTime?: number;
  executionTime?: number;
  success?: boolean;
  completedIds?: number[];
}

export interface ParallelSubtaskData {
  subtaskId: number;
  waveNumber: number;
  description?: string;
  success?: boolean;
  result?: string;
  error?: string;
  executionTime?: number;
}

// ============================================================================
// Multi-Agent Types
// ============================================================================

export interface SubagentInfo {
  id?: string;
  name: string;
  role?: string;
  task?: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  executionTime?: number;
}

// ============================================================================
// Claude SDK Native Chunk Types
// ============================================================================

export interface SearchResultItem {
  filePath: string;
  lineNumber?: number;
  snippet?: string;
}

export interface SubagentChunkData {
  subagentId: string;
  subagentType: string;
  description: string;
  prompt?: string;
  status: "running" | "completed" | "failed";
  result?: string;
  durationMs?: number;
  nestedChunks: StreamingChunk[];
}

export interface FileOperationChunkData {
  toolUseId: string;
  operation: "read" | "write" | "edit";
  filePath: string;
  status: "pending" | "completed" | "error";
  content?: string;
  totalLines?: number;
  language?: string;
  oldString?: string;
  newString?: string;
  error?: string;
  durationMs?: number;
}

export interface TerminalChunkData {
  toolUseId: string;
  command: string;
  description?: string;
  status: "running" | "completed" | "failed";
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
}

export interface SearchResultsChunkData {
  toolUseId: string;
  tool: "glob" | "grep";
  pattern: string;
  path?: string;
  status: "pending" | "completed" | "error";
  results: SearchResultItem[];
  totalCount: number;
  error?: string;
  durationMs?: number;
}

export interface WebOperationChunkData {
  toolUseId: string;
  operation: "search" | "fetch";
  query?: string;
  url?: string;
  status: "pending" | "completed" | "error";
  results?: string;
  content?: string;
  error?: string;
  durationMs?: number;
}

export interface ClaudeToolChunkData {
  toolUseId: string;
  toolName: string;
  toolDescription?: string;
  toolInput?: Record<string, unknown>;
  status: "pending" | "completed" | "error";
  content?: string;
  isError?: boolean;
  durationMs?: number;
}

export interface ClarificationData {
  question: string;
  options?: string[];
  context?: string;
  allowFreeText?: boolean;
  subtaskId?: number;
  subtaskDescription?: string;
  subagentName?: string;
  subagentRole?: string;
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
  | "progress";

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
  change?: string;
  changeLabel?: string;
  sparkline?: number[];
  color?: string;
}

export interface KpiVisualizationData {
  metrics: KpiMetric[];
  layout?: "row" | "grid";
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

  // Plan & Execute fields
  subtaskId?: number;
  sequence?: number;
  subtaskData?: SubTaskData;
  planData?: PlanData;
  progress?: ProgressData;
  isReplan?: boolean;

  // Parallel Plan (wave-based) fields
  waveData?: WaveData;
  parallelSubtaskData?: ParallelSubtaskData;
  waveNumber?: number;
  isParallel?: boolean;

  // Multi-Agent (miiflow-llm) fields
  isMultiAgent?: boolean;
  subagentInfo?: SubagentInfo;
  subagentAllocations?: { name: string; focus: string; query?: string }[];

  // Replanning context
  replanAttempt?: number;
  maxReplans?: number;
  failureReason?: string;

  // Synthesis phase
  isSynthesis?: boolean;

  // Orchestrator context (for nested execution)
  orchestrator?: "react" | "plan_execute" | "claude_agent_sdk";
  parentSubtaskId?: number;

  // Claude SDK Native Fields
  subagentData?: SubagentChunkData;
  fileOperationData?: FileOperationChunkData;
  terminalData?: TerminalChunkData;
  searchResultsData?: SearchResultsChunkData;
  webOperationData?: WebOperationChunkData;
  claudeToolData?: ClaudeToolChunkData;
  clarificationData?: ClarificationData;
  visualizationData?: VisualizationChunkData;
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
  orchestratorType?: "react" | "plan_execute" | "claude_agent_sdk";
  executionPlan?: PlanData;

  // Parallel execution metadata
  isParallelExecution?: boolean;
  waveData?: Record<number, WaveData>;
  currentWaveNumber?: number;

  // Follow-up actions
  suggestedActions?: FollowupAction[];

  // Claude SDK specific
  activeSubagents?: Map<string, SubagentChunkData>;

  // Pending clarification
  pendingClarification?: ClarificationData;

  // Visualizations
  visualizations?: VisualizationChunkData[];
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

export type EventType = "thinking" | "planning" | "tool" | "observation" | "subtask";

export interface BaseEvent {
  id: string;
  type: EventType;
  status: EventStatus;
  timestamp?: number;
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

export type Event = ThinkingEvent | PlanningEvent | ToolEvent | ObservationEvent | SubtaskEvent;

// ============================================================================
// Visualization Action Event (interaction callbacks)
// ============================================================================

export type VisualizationActionEvent =
  | { type: "form_submit"; action: string; data: Record<string, unknown> }
  | { type: "form_cancel"; action: string }
  | { type: "card_action"; action: string };
