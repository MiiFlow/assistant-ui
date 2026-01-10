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
  subtaskData?: SubTaskData;
  planData?: PlanData;
  progress?: ProgressData;
  isReplan?: boolean;

  // Replanning context
  replanAttempt?: number;
  maxReplans?: number;
  failureReason?: string;

  // Synthesis phase
  isSynthesis?: boolean;

  // Orchestrator context (for nested execution)
  orchestrator?: "react" | "plan_execute" | "claude_agent_sdk";
  parentSubtaskId?: number;
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

  // Follow-up actions
  suggestedActions?: FollowupAction[];
}

/**
 * Follow-up action suggested by AI
 */
export interface FollowupAction {
  label: string;
  action: string;
  type: "send_message" | "navigate" | "copy_text" | "api_call";
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
