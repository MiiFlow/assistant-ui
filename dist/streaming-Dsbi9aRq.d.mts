/**
 * Types for streaming message handling.
 */
interface StreamingState {
    isStreaming: boolean;
    streamingMessageId: string | null;
    streamedContent: string;
}
interface StreamChunk {
    type: "content" | "reasoning" | "tool_call" | "done" | "error";
    content?: string;
    messageId?: string;
    error?: string;
}
interface StreamingOptions {
    onChunk?: (chunk: StreamChunk) => void;
    onComplete?: (finalContent: string) => void;
    onError?: (error: Error) => void;
}
/**
 * Extended chunk types for agentic streaming
 */
type ChunkType = "content" | "thinking" | "tool" | "observation" | "answer" | "planning" | "subtask" | "progress";
/**
 * Subtask data structure for Plan & Execute mode
 */
interface SubTaskData {
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
interface PlanData {
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
interface ProgressData {
    completed: number;
    failed?: number;
    total: number;
    percentage: number;
}
/**
 * Extended streaming chunk with full agentic support
 */
interface StreamingChunk {
    type: ChunkType;
    content: string;
    toolName?: string;
    toolDescription?: string;
    toolArgs?: Record<string, unknown>;
    success?: boolean;
    status?: "planned" | "executing" | "completed";
    subtaskId?: number;
    subtaskData?: SubTaskData;
    planData?: PlanData;
    progress?: ProgressData;
    isReplan?: boolean;
    replanAttempt?: number;
    maxReplans?: number;
    failureReason?: string;
    isSynthesis?: boolean;
    orchestrator?: "react" | "plan_execute";
    parentSubtaskId?: number;
}
/**
 * Streaming message with chunks and metadata
 */
interface StreamingMessage {
    id?: string;
    textContent: string;
    previousMessageId?: string;
    chunks?: StreamingChunk[];
    orchestratorType?: "react" | "plan_execute";
    executionPlan?: PlanData;
    suggestedActions?: FollowupAction[];
}
/**
 * Follow-up action suggested by AI
 */
interface FollowupAction {
    label: string;
    action: string;
    type: "send_message" | "navigate" | "copy_text" | "api_call";
    context: Record<string, unknown>;
}
type EventStatus = "pending" | "running" | "completed" | "failed";
type EventType = "thinking" | "planning" | "tool" | "observation" | "subtask";
interface BaseEvent {
    id: string;
    type: EventType;
    status: EventStatus;
    timestamp?: number;
}
interface ThinkingEvent extends BaseEvent {
    type: "thinking";
    content: string;
}
interface PlanningEvent extends BaseEvent {
    type: "planning";
    content: string;
    isComplete?: boolean;
}
interface ToolEvent extends BaseEvent {
    type: "tool";
    toolName: string;
    toolDescription?: string;
    input?: unknown;
}
interface ObservationEvent extends BaseEvent {
    type: "observation";
    toolName: string;
    content: string;
    success?: boolean;
}
interface SubtaskEvent extends BaseEvent {
    type: "subtask";
    title: string;
    description?: string;
    executionTime?: number;
    result?: string;
    error?: string;
    children?: Event[];
}
type Event = ThinkingEvent | PlanningEvent | ToolEvent | ObservationEvent | SubtaskEvent;

export type { ChunkType as C, EventStatus as E, FollowupAction as F, ObservationEvent as O, PlanData as P, StreamingChunk as S, ThinkingEvent as T, StreamingState as a, StreamChunk as b, StreamingOptions as c, Event as d, StreamingMessage as e, SubTaskData as f, ProgressData as g, EventType as h, PlanningEvent as i, ToolEvent as j, SubtaskEvent as k };
