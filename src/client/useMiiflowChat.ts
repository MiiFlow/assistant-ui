/**
 * useMiiflowChat - React hook for connecting to Miiflow's embedded chat API.
 *
 * Handles session init, SSE streaming, message management, tool registration,
 * and branding. Returns a shape directly compatible with ChatProvider props.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type {
  ChatMessage,
  ParticipantRole,
  StreamingChunk,
  ClarificationData,
  ProgressData,
  FileOperationChunkData,
  TerminalChunkData,
  SearchResultsChunkData,
  WebOperationChunkData,
  SubagentChunkData,
  ClaudeToolChunkData,
} from "../types";
import type { BrandingData } from "../types/branding";
import type {
  MiiflowChatConfig,
  MiiflowChatResult,
  EmbedSession,
  ClientToolDefinition,
  ToolHandler,
  ToolInvocationRequest,
  SystemEvent,
} from "./types";
import {
  initSession,
  getBackendBaseUrl,
  getOrCreateUserId,
  createThread,
  registerToolsOnBackend,
  uploadFile as uploadFileToBackend,
  sendSystemEvent as sendSystemEventToBackend,
  sendToolResult,
} from "./session";
import { validateToolDefinition, serializeToolDefinition } from "./tool-validator";
import { useBrandingCSSVars } from "../hooks/use-branding-css-vars";

// ============================================================================
// WebSocket helpers
// ============================================================================

const WS_HEARTBEAT_INTERVAL = 21000; // 21 seconds — matches web app
const WS_RECONNECT_BASE_DELAY = 1000;
const WS_RECONNECT_MAX_DELAY = 30000;

function buildWebSocketUrl(config: MiiflowChatConfig, session: EmbedSession): string {
  if (config.webSocketUrl) {
    const url = new URL(config.webSocketUrl);
    url.pathname = `/ws/assistant/thread/${session.config.thread_id}/`;
    url.searchParams.set("role", "user");
    url.searchParams.set("user_id", getOrCreateUserId());
    url.searchParams.set("embed_token", session.token);
    return url.toString();
  }

  const baseUrl = getBackendBaseUrl(config);
  // Strip /api suffix to get host origin, then convert protocol
  const origin = baseUrl.replace(/\/api$/, "");
  const wsOrigin = origin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  const userId = getOrCreateUserId();
  return `${wsOrigin}/ws/assistant/thread/${session.config.thread_id}/?role=user&user_id=${encodeURIComponent(userId)}&embed_token=${encodeURIComponent(session.token)}`;
}

// ============================================================================
// Internal types
// ============================================================================

interface InternalMessage {
  id: string;
  textContent: string;
  participant: {
    id: string;
    name: string;
    role: ParticipantRole;
    avatarUrl?: string;
  };
  createdAt: string;
  isStreaming?: boolean;
  reasoning?: StreamingChunk[];
  suggestedActions?: Array<{ id: string; label: string; value: string }>;
  citations?: import("../types").SourceReference[];
  attachments?: import("../types").Attachment[];
  pendingClarification?: ClarificationData;
  /** Wall-clock execution time in seconds, persisted after streaming completes */
  executionTime?: number;
}

type ChunkType =
  | "answer"
  | "thinking"
  | "tool"
  | "observation"
  | "planning"
  | "subtask"
  | "progress"
  | "clarification_needed"
  // Multi-Agent
  | "multi_agent_planning"
  | "subagent_start"
  | "subagent_complete"
  | "subagent_failed"
  | "synthesis"
  // Claude SDK
  | "claude_text"
  | "claude_thinking"
  | "subagent"
  | "file_operation"
  | "terminal"
  | "search_results"
  | "web_operation";

interface AccumulatedChunk {
  type: string;
  content: string;
  toolName?: string;
  toolDescription?: string;
  status?: string;
  success?: boolean;
  subtaskId?: number;
  clarificationData?: ClarificationData;
  // Plan & Execute metadata
  planData?: import("../types").PlanData;
  subtaskData?: import("../types").SubTaskData;
  isSynthesis?: boolean;
  isReplan?: boolean;
  // Parallel plan fields
  waveData?: import("../types").WaveData;
  parallelSubtaskData?: import("../types").ParallelSubtaskData;
  waveNumber?: number;
  isParallel?: boolean;
  // Multi-Agent fields
  isMultiAgent?: boolean;
  subagentInfo?: import("../types").SubagentInfo;
  subagentAllocations?: { name: string; focus: string; query?: string }[];
  // Missing data fields (Gap C)
  toolArgs?: Record<string, unknown>;
  replanAttempt?: number;
  maxReplans?: number;
  failureReason?: string;
  progress?: ProgressData;
  // Claude SDK fields
  orchestrator?: string;
  toolUseId?: string;
  subagentData?: SubagentChunkData;
  fileOperationData?: FileOperationChunkData;
  terminalData?: TerminalChunkData;
  searchResultsData?: SearchResultsChunkData;
  webOperationData?: WebOperationChunkData;
  claudeToolData?: ClaudeToolChunkData;
}

// ============================================================================
// Branding mapper
// ============================================================================

function mapSessionBranding(
  session: EmbedSession | null
): BrandingData | null {
  const b = session?.config.branding;
  if (!b) return null;
  return {
    customName: b.custom_name,
    messageFontSize: b.message_font_size,
    welcomeMessage: b.welcome_message,
    chatboxPlaceholder: b.chatbox_placeholder,
    backgroundBubbleColor: b.background_bubble_color,
    headerBackgroundColor: b.header_background_color,
    showHeader: b.show_header,
    rotatingPlaceholders: b.rotating_placeholders,
    presetQuestions: b.preset_questions,
    chatbotLogo: b.chatbot_logo,
    assistantAvatar: b.assistant_avatar,
  };
}

// ============================================================================
// SSE stream parser
// ============================================================================

interface StreamParseCallbacks {
  onMessageUpdate: (msg: Partial<InternalMessage> & { id: string }) => void;
  onMessageCreate: (msg: InternalMessage) => void;
  onUserMessageIdUpdate: (optimisticId: string, newId: string) => void;
  onComplete: (
    assistantMsgId: string | null,
    finalContent: string,
    finalId?: string,
    chunks?: StreamingChunk[],
    suggestedActions?: Array<{ id: string; label: string; value: string }>,
    sources?: any[],
    pendingClarification?: ClarificationData,
    executionTime?: number
  ) => void;
  onToolInvocation?: (invocation: ToolInvocationRequest) => void;
}

async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  session: EmbedSession,
  optimisticId: string,
  callbacks: StreamParseCallbacks
): Promise<{ assistantMsgId: string | null; assistantContent: string }> {
  const decoder = new TextDecoder();
  const streamStartTime = Date.now();
  let assistantContent = "";
  let assistantMsgId: string | null = null;
  const chunks: AccumulatedChunk[] = [];
  let suggestedActions:
    | Array<{ id: string; label: string; value: string }>
    | undefined;
  let pendingClarification: ClarificationData | undefined;
  let receivedComplete = false;

  // Chunk accumulation state
  let currentChunkType: ChunkType = "answer";
  let currentChunkContent = "";
  let currentToolName: string | undefined;
  let currentToolDescription: string | undefined;
  let currentSuccess: boolean | undefined;
  let currentToolStatus: "planned" | "executing" | "completed" | undefined;
  let currentSubtaskId: number | undefined;
  // Plan & Execute metadata (preserved through finalizeChunk)
  let currentPlanData: import("../types").PlanData | undefined;
  let currentSubtaskData: import("../types").SubTaskData | undefined;
  let currentIsSynthesis: boolean | undefined;
  let currentIsReplan: boolean | undefined;
  // Missing data fields (Gap C)
  let currentToolArgs: Record<string, unknown> | undefined;
  let currentReplanAttempt: number | undefined;
  let currentMaxReplans: number | undefined;
  let currentFailureReason: string | undefined;
  let currentProgress: ProgressData | undefined;
  // Multi-agent tracking
  let isMultiAgentMode = false;

  let lineBuffer = "";

  const branding = session.config.branding;

  const finalizeChunk = () => {
    if (currentChunkContent || currentChunkType === "tool") {
      chunks.push({
        type: currentChunkType,
        content: currentChunkContent,
        toolName: currentToolName,
        toolDescription: currentToolDescription,
        success: currentSuccess,
        status: currentToolStatus,
        subtaskId: currentSubtaskId,
        planData: currentPlanData,
        subtaskData: currentSubtaskData,
        isSynthesis: currentIsSynthesis,
        isReplan: currentIsReplan,
        toolArgs: currentToolArgs,
        replanAttempt: currentReplanAttempt,
        maxReplans: currentMaxReplans,
        failureReason: currentFailureReason,
        progress: currentProgress,
      });
      currentChunkContent = "";
      currentToolName = undefined;
      currentToolDescription = undefined;
      currentSuccess = undefined;
      currentToolStatus = undefined;
      currentSubtaskId = undefined;
      currentPlanData = undefined;
      currentSubtaskData = undefined;
      currentIsSynthesis = undefined;
      currentIsReplan = undefined;
      currentToolArgs = undefined;
      currentReplanAttempt = undefined;
      currentMaxReplans = undefined;
      currentFailureReason = undefined;
      currentProgress = undefined;
    }
  };

  const buildDisplayChunks = (): StreamingChunk[] => {
    const display = chunks.map((c) => c as unknown as StreamingChunk);
    if (currentChunkContent || currentChunkType === "tool") {
      display.push({
        type: currentChunkType as StreamingChunk["type"],
        content: currentChunkContent,
        toolName: currentToolName,
        toolDescription: currentToolDescription,
        success: currentSuccess,
        status: currentToolStatus as StreamingChunk["status"],
        subtaskId: currentSubtaskId,
        planData: currentPlanData,
        subtaskData: currentSubtaskData,
        isSynthesis: currentIsSynthesis,
        isReplan: currentIsReplan,
        toolArgs: currentToolArgs,
        replanAttempt: currentReplanAttempt,
        maxReplans: currentMaxReplans,
        failureReason: currentFailureReason,
        progress: currentProgress,
      });
    }
    return display;
  };

  const updateStreamingMessage = () => {
    const displayChunks = buildDisplayChunks();

    if (!assistantMsgId) {
      assistantMsgId = `assistant-${Date.now()}`;
      const assistantMsg: InternalMessage = {
        id: assistantMsgId,
        textContent: assistantContent,
        participant: {
          id: "assistant",
          name:
            branding?.custom_name || session.config.assistant_name,
          role: "assistant",
          avatarUrl: branding?.assistant_avatar,
        },
        createdAt: new Date().toISOString(),
        isStreaming: true,
        reasoning: displayChunks,
        suggestedActions,
      };
      callbacks.onMessageCreate(assistantMsg);
    } else {
      callbacks.onMessageUpdate({
        id: assistantMsgId,
        textContent: assistantContent,
        reasoning: displayChunks,
        suggestedActions,
      });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const rawChunk = decoder.decode(value, { stream: true });
    const text = lineBuffer + rawChunk;
    const lines = text.split("\n");

    if (!rawChunk.endsWith("\n")) {
      lineBuffer = lines.pop() || "";
    } else {
      lineBuffer = "";
    }

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const data = line.slice(6);
      if (data === "[DONE]") break;

      try {
        const parsed = JSON.parse(data);

        if (parsed.type === "assistant_chunk") {
          // Handle tool planned
          if (parsed.is_tool_planned) {
            if (currentChunkContent || currentChunkType !== "answer") {
              finalizeChunk();
              currentChunkType = "answer";
            }

            chunks.push({
              type: "tool",
              content: "",
              toolName: parsed.tool_name,
              toolDescription: parsed.tool_description,
              status: "planned",
              subtaskId: parsed.subtask_id,
            });
            updateStreamingMessage();
            continue;
          }

          // Handle tool executing
          if (parsed.is_tool_executing) {
            for (let i = chunks.length - 1; i >= 0; i--) {
              const chunk = chunks[i];
              if (
                chunk.type === "tool" &&
                chunk.toolName === parsed.tool_name &&
                (parsed.subtask_id === undefined ||
                  chunk.subtaskId === parsed.subtask_id)
              ) {
                chunks[i].status = "executing";
                break;
              }
            }
            updateStreamingMessage();
            continue;
          }

          // Handle observation
          if (parsed.is_observation) {
            for (let i = chunks.length - 1; i >= 0; i--) {
              const chunk = chunks[i];
              if (
                chunk.type === "tool" &&
                chunk.toolName === parsed.tool_name &&
                (parsed.subtask_id === undefined ||
                  chunk.subtaskId === parsed.subtask_id)
              ) {
                chunks[i].status = "completed";
                break;
              }
            }
            updateStreamingMessage();
            continue;
          }

          // Handle suggested actions
          if (parsed.suggested_actions) {
            suggestedActions = parsed.suggested_actions.map(
              (a: { action: string; label: string }) => ({
                id: a.action,
                label: a.label,
                value: a.action,
              })
            );
            updateStreamingMessage();
            continue;
          }

          // Handle wave/parallel execution events
          if (parsed.is_wave_start) {
            if (currentChunkContent || currentChunkType !== "answer") {
              finalizeChunk();
              currentChunkType = "answer";
            }
            chunks.push({
              type: "wave_start",
              content: "",
              waveNumber: parsed.wave_number,
              isParallel: true,
              waveData: {
                waveNumber: parsed.wave_number,
                subtaskIds: parsed.subtask_ids || [],
                parallelCount: parsed.parallel_count || 0,
                totalWaves: parsed.total_waves || 1,
              },
            } as unknown as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_wave_complete) {
            chunks.push({
              type: "wave_complete",
              content: "",
              waveNumber: parsed.wave_number,
              isParallel: true,
              waveData: {
                waveNumber: parsed.wave_number,
                subtaskIds: [],
                parallelCount: 0,
                totalWaves: 0,
                completedIds: parsed.completed_ids || [],
                success: parsed.success,
                executionTime: parsed.execution_time,
              },
            } as unknown as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_parallel_subtask_start) {
            chunks.push({
              type: "parallel_subtask_start",
              content: "",
              subtaskId: parsed.subtask_id,
              waveNumber: parsed.wave_number,
              isParallel: true,
              parallelSubtaskData: {
                subtaskId: parsed.subtask_id,
                waveNumber: parsed.wave_number,
                description: parsed.description,
              },
            } as unknown as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_parallel_subtask_complete) {
            chunks.push({
              type: "parallel_subtask_complete",
              content: "",
              subtaskId: parsed.subtask_id,
              waveNumber: parsed.wave_number,
              isParallel: true,
              success: parsed.success,
              parallelSubtaskData: {
                subtaskId: parsed.subtask_id,
                waveNumber: parsed.wave_number,
                success: parsed.success,
                result: parsed.result,
                error: parsed.error,
                executionTime: parsed.execution_time,
              },
            } as unknown as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          // ============================================
          // Multi-Agent Event Handlers (miiflow-llm orchestrator)
          // ============================================

          if (parsed.is_multi_agent_planning) {
            isMultiAgentMode = true;
            if (currentChunkContent || currentChunkType !== "answer") {
              finalizeChunk();
              currentChunkType = "answer";
            }
            chunks.push({
              type: "multi_agent_planning",
              content: "",
              isMultiAgent: true,
            } as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_reasoning && parsed.reasoning_delta) {
            // Multi-agent planning reasoning — accumulate into a thinking chunk
            const existingIdx = chunks.findIndex(
              (c) => c.type === "thinking" && c.isMultiAgent
            );
            if (existingIdx >= 0) {
              chunks[existingIdx] = {
                ...chunks[existingIdx],
                content: (chunks[existingIdx].content || "") + parsed.reasoning_delta,
              };
            } else {
              chunks.push({
                type: "thinking",
                content: parsed.reasoning_delta,
                isMultiAgent: true,
              } as AccumulatedChunk);
            }
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_multi_agent_planning_complete) {
            // Update existing multi_agent_planning chunk with subagent allocations
            const planningIdx = chunks.findIndex(
              (c) => c.type === "multi_agent_planning" && c.isMultiAgent
            );
            if (planningIdx >= 0) {
              chunks[planningIdx] = {
                ...chunks[planningIdx],
                subagentAllocations: parsed.subagents || [],
              };
            } else {
              chunks.push({
                type: "multi_agent_planning",
                content: "",
                isMultiAgent: true,
                subagentAllocations: parsed.subagents || [],
              } as AccumulatedChunk);
            }
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_multi_agent_execution_start) {
            // No UI update needed — subagent_start events follow
            continue;
          }

          if (parsed.is_subagent_start) {
            chunks.push({
              type: "subagent_start",
              content: "",
              isMultiAgent: true,
              subagentInfo: {
                id: parsed.subagent_id,
                name: parsed.subagent_name,
                task: parsed.task,
                status: "running",
              },
            } as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_subagent_progress) {
            // Update existing subagent chunk with progress
            const subagentIndex = chunks.findIndex(
              (c) =>
                c.type === "subagent_start" &&
                c.subagentInfo?.id === parsed.subagent_id
            );
            if (subagentIndex !== -1 && chunks[subagentIndex].subagentInfo) {
              chunks[subagentIndex] = {
                ...chunks[subagentIndex],
                content: parsed.progress || "",
              };
            }
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_subagent_complete) {
            chunks.push({
              type: "subagent_complete",
              content: "",
              isMultiAgent: true,
              subagentInfo: {
                id: parsed.subagent_id,
                name: parsed.subagent_name,
                status: "completed",
                result: parsed.result,
                executionTime: parsed.execution_time,
              },
            } as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          if (parsed.is_subagent_failed) {
            chunks.push({
              type: "subagent_failed",
              content: "",
              isMultiAgent: true,
              subagentInfo: {
                id: parsed.subagent_id,
                name: parsed.subagent_name,
                status: "failed",
                error: parsed.error,
              },
            } as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          // Multi-agent synthesis (standalone) — creates synthesis chunk
          if (parsed.is_synthesis_start && isMultiAgentMode) {
            chunks.push({
              type: "synthesis",
              content: "",
              isMultiAgent: true,
              isSynthesis: true,
            } as AccumulatedChunk);
            updateStreamingMessage();
            continue;
          }

          // Extract plan_data metadata when present
          if (parsed.plan_data) {
            const backendPlan = parsed.plan_data;
            currentPlanData = {
              goal: backendPlan.goal || "",
              reasoning: backendPlan.reasoning || "",
              subtasks: (backendPlan.subtasks || []).map((st: any) => ({
                id: Number(st.id),
                description: st.description,
                required_tools: st.required_tools,
                dependencies: st.dependencies,
                status: "pending" as const,
              })),
              total_subtasks: backendPlan.subtasks?.length || 0,
              completed_subtasks: 0,
              failed_subtasks: 0,
              progress_percentage: 0,
            };
          }

          // Extract subtask_data metadata when present
          if (parsed.subtask_data) {
            currentSubtaskData = parsed.subtask_data;
          }

          // Track synthesis and replan flags
          if (parsed.is_synthesis_start) {
            currentIsSynthesis = true;
          }
          if (parsed.is_replan) {
            currentIsReplan = true;
          }

          // Track missing data fields (Gap C)
          if (parsed.tool_args) currentToolArgs = parsed.tool_args;
          if (parsed.replan_attempt !== undefined) currentReplanAttempt = parsed.replan_attempt;
          if (parsed.max_replans !== undefined) currentMaxReplans = parsed.max_replans;
          if (parsed.failure_reason) currentFailureReason = parsed.failure_reason;
          if (parsed.progress) currentProgress = parsed.progress;

          // Determine chunk type
          let newChunkType: ChunkType = "answer";
          if (parsed.is_thinking) {
            newChunkType = "thinking";
          } else if (
            parsed.is_planning ||
            parsed.is_plan_complete ||
            parsed.is_replanning
          ) {
            newChunkType = "planning";
          } else if (
            parsed.is_subtask_start ||
            parsed.is_subtask_complete ||
            parsed.is_subtask_failed
          ) {
            newChunkType = "subtask";
          } else if (parsed.is_progress_update) {
            newChunkType = "progress";
          }

          if (newChunkType !== currentChunkType) {
            finalizeChunk();
            currentChunkType = newChunkType;
          }

          if (parsed.tool_name) currentToolName = parsed.tool_name;
          if (parsed.success !== undefined) currentSuccess = parsed.success;
          if (parsed.subtask_id !== undefined)
            currentSubtaskId = parsed.subtask_id;

          // Accumulate content
          if (newChunkType === "thinking") {
            currentChunkContent += parsed.chunk || "";
            const match = currentChunkContent.match(
              /"thought"\s*:\s*"((?:[^"\\]|\\.)*)"/
            );
            if (match) {
              currentChunkContent = match[1]
                .replace(/\\n/g, "\n")
                .replace(/\\"/g, '"')
                .replace(/\\t/g, "\t")
                .replace(/\\\\/g, "\\");
            }
          } else if (newChunkType === "answer") {
            const chunkTrimmed = parsed.chunk?.trim() || "";
            const accumulatedTrimmed = assistantContent.trim();
            if (
              !(
                chunkTrimmed &&
                accumulatedTrimmed &&
                chunkTrimmed === accumulatedTrimmed
              )
            ) {
              assistantContent += parsed.chunk || "";
            }
          } else {
            currentChunkContent += parsed.chunk || "";
          }

          // Update user message ID
          if (parsed.previous_message_id) {
            callbacks.onUserMessageIdUpdate(
              optimisticId,
              parsed.previous_message_id
            );
          }

          updateStreamingMessage();
        }
        // ============================================
        // Claude SDK Native Event Handlers (Gap B)
        // ============================================
        else if (parsed.type === "claude_text") {
          // Claude SDK text chunk — accumulate into assistant content
          assistantContent += parsed.chunk || "";

          const existingTextChunk = chunks.find(
            (c) => c.type === "claude_text"
          );
          if (existingTextChunk) {
            existingTextChunk.content += parsed.chunk || "";
          } else {
            chunks.push({
              type: "claude_text",
              content: parsed.chunk || "",
              orchestrator: "claude_agent_sdk",
            } as AccumulatedChunk);
          }
          updateStreamingMessage();
        } else if (parsed.type === "claude_thinking") {
          // Claude SDK extended thinking
          chunks.push({
            type: "claude_thinking",
            content: parsed.content || "",
            orchestrator: "claude_agent_sdk",
          } as AccumulatedChunk);
          updateStreamingMessage();
        } else if (parsed.type === "claude_file_read") {
          const fileOpData: FileOperationChunkData = {
            toolUseId: parsed.tool_use_id,
            operation: "read",
            filePath: parsed.file_path,
            status: parsed.status,
            content: parsed.content,
            totalLines: parsed.total_lines,
            language: parsed.language,
            error: parsed.error,
            durationMs: parsed.duration_ms,
          };
          const existingIdx = chunks.findIndex(
            (c) =>
              c.type === "file_operation" &&
              c.toolUseId === parsed.tool_use_id
          );
          if (existingIdx >= 0) {
            chunks[existingIdx].fileOperationData = fileOpData;
          } else {
            chunks.push({
              type: "file_operation",
              content: "",
              toolUseId: parsed.tool_use_id,
              fileOperationData: fileOpData,
              orchestrator: "claude_agent_sdk",
            } as AccumulatedChunk);
          }
          updateStreamingMessage();
        } else if (parsed.type === "claude_file_edit") {
          const fileEditData: FileOperationChunkData = {
            toolUseId: parsed.tool_use_id,
            operation: "edit",
            filePath: parsed.file_path,
            status: parsed.status,
            oldString: parsed.old_string,
            newString: parsed.new_string,
            error: parsed.error,
            durationMs: parsed.duration_ms,
          };
          const existingIdx = chunks.findIndex(
            (c) =>
              c.type === "file_operation" &&
              c.toolUseId === parsed.tool_use_id
          );
          if (existingIdx >= 0) {
            chunks[existingIdx].fileOperationData = fileEditData;
          } else {
            chunks.push({
              type: "file_operation",
              content: "",
              toolUseId: parsed.tool_use_id,
              fileOperationData: fileEditData,
              orchestrator: "claude_agent_sdk",
            } as AccumulatedChunk);
          }
          updateStreamingMessage();
        } else if (parsed.type === "claude_file_write") {
          const fileWriteData: FileOperationChunkData = {
            toolUseId: parsed.tool_use_id,
            operation: "write",
            filePath: parsed.file_path,
            status: parsed.status,
            error: parsed.error,
            durationMs: parsed.duration_ms,
          };
          const existingIdx = chunks.findIndex(
            (c) =>
              c.type === "file_operation" &&
              c.toolUseId === parsed.tool_use_id
          );
          if (existingIdx >= 0) {
            chunks[existingIdx].fileOperationData = fileWriteData;
          } else {
            chunks.push({
              type: "file_operation",
              content: "",
              toolUseId: parsed.tool_use_id,
              fileOperationData: fileWriteData,
              orchestrator: "claude_agent_sdk",
            } as AccumulatedChunk);
          }
          updateStreamingMessage();
        } else if (parsed.type === "claude_bash") {
          const termData: TerminalChunkData = {
            toolUseId: parsed.tool_use_id,
            command: parsed.command,
            description: parsed.description,
            status: parsed.status,
            stdout: parsed.stdout,
            stderr: parsed.stderr,
            exitCode: parsed.exit_code,
            durationMs: parsed.duration_ms,
          };
          const existingIdx = chunks.findIndex(
            (c) =>
              c.type === "terminal" && c.toolUseId === parsed.tool_use_id
          );
          if (existingIdx >= 0) {
            chunks[existingIdx].terminalData = termData;
          } else {
            chunks.push({
              type: "terminal",
              content: "",
              toolUseId: parsed.tool_use_id,
              terminalData: termData,
              orchestrator: "claude_agent_sdk",
            } as AccumulatedChunk);
          }
          updateStreamingMessage();
        } else if (parsed.type === "claude_search") {
          const searchData: SearchResultsChunkData = {
            toolUseId: parsed.tool_use_id,
            tool: parsed.tool,
            pattern: parsed.pattern,
            path: parsed.path,
            status: parsed.status,
            results: (parsed.results || []).map((r: any) => ({
              filePath: r.file_path,
              lineNumber: r.line_number,
              snippet: r.snippet,
            })),
            totalCount: parsed.total_count || 0,
            error: parsed.error,
            durationMs: parsed.duration_ms,
          };
          const existingIdx = chunks.findIndex(
            (c) =>
              c.type === "search_results" &&
              c.toolUseId === parsed.tool_use_id
          );
          if (existingIdx >= 0) {
            chunks[existingIdx].searchResultsData = searchData;
          } else {
            chunks.push({
              type: "search_results",
              content: "",
              toolUseId: parsed.tool_use_id,
              searchResultsData: searchData,
              orchestrator: "claude_agent_sdk",
            } as AccumulatedChunk);
          }
          updateStreamingMessage();
        } else if (
          parsed.type === "claude_web_search" ||
          parsed.type === "claude_web_fetch"
        ) {
          const webOpData: WebOperationChunkData = {
            toolUseId: parsed.tool_use_id,
            operation:
              parsed.type === "claude_web_search" ? "search" : "fetch",
            query: parsed.query,
            url: parsed.url,
            status: parsed.status,
            results: parsed.results,
            content: parsed.content,
            error: parsed.error,
            durationMs: parsed.duration_ms,
          };
          const existingIdx = chunks.findIndex(
            (c) =>
              c.type === "web_operation" &&
              c.toolUseId === parsed.tool_use_id
          );
          if (existingIdx >= 0) {
            chunks[existingIdx].webOperationData = webOpData;
          } else {
            chunks.push({
              type: "web_operation",
              content: "",
              toolUseId: parsed.tool_use_id,
              webOperationData: webOpData,
              orchestrator: "claude_agent_sdk",
            } as AccumulatedChunk);
          }
          updateStreamingMessage();
        } else if (parsed.type === "claude_subagent_start") {
          const subData: SubagentChunkData = {
            subagentId: parsed.subagent_id,
            subagentType: parsed.subagent_type,
            description: parsed.description,
            prompt: parsed.prompt,
            status: "running",
            nestedChunks: [],
          };
          chunks.push({
            type: "subagent",
            content: "",
            toolUseId: parsed.parent_tool_use_id,
            subagentData: subData,
            orchestrator: "claude_agent_sdk",
          } as AccumulatedChunk);
          updateStreamingMessage();
        } else if (parsed.type === "claude_subagent_chunk") {
          // Append to existing subagent's nested chunks
          const subagentIdx = chunks.findIndex(
            (c) =>
              c.type === "subagent" &&
              c.subagentData?.subagentId === parsed.subagent_id
          );
          if (subagentIdx >= 0 && chunks[subagentIdx].subagentData) {
            chunks[subagentIdx].subagentData!.nestedChunks.push({
              type: parsed.is_tool ? "tool" : "answer",
              content: parsed.chunk || "",
              toolName: parsed.tool_name,
              orchestrator: "claude_agent_sdk",
            } as unknown as StreamingChunk);
          }
          updateStreamingMessage();
        } else if (parsed.type === "claude_subagent_complete") {
          // Update existing subagent chunk with completion info
          const subagentIdx = chunks.findIndex(
            (c) =>
              c.type === "subagent" &&
              c.subagentData?.subagentId === parsed.subagent_id
          );
          if (subagentIdx >= 0 && chunks[subagentIdx].subagentData) {
            chunks[subagentIdx].subagentData!.status = "completed";
            chunks[subagentIdx].subagentData!.result = parsed.result;
            chunks[subagentIdx].subagentData!.durationMs =
              parsed.duration_ms;
          }
          updateStreamingMessage();
        } else if (
          parsed.type === "claude_tool_use" ||
          parsed.type === "claude_tool_result"
        ) {
          // Generic Claude tool (MCP tools, etc.)
          const claudeToolData: ClaudeToolChunkData = {
            toolUseId: parsed.tool_use_id,
            toolName: parsed.tool_name,
            toolDescription: parsed.tool_description,
            toolInput: parsed.tool_input,
            status:
              parsed.type === "claude_tool_use"
                ? "pending"
                : parsed.is_error
                  ? "error"
                  : "completed",
            content: parsed.content,
            isError: parsed.is_error,
            durationMs: parsed.duration_ms,
          };
          const existingIdx = chunks.findIndex(
            (c) => c.claudeToolData?.toolUseId === parsed.tool_use_id
          );
          if (existingIdx >= 0) {
            chunks[existingIdx].claudeToolData = claudeToolData;
          } else {
            chunks.push({
              type: "tool",
              content: parsed.content || "",
              toolUseId: parsed.tool_use_id,
              toolName: parsed.tool_name,
              toolDescription: parsed.tool_description,
              status:
                claudeToolData.status === "pending" ? "planned" : "completed",
              claudeToolData,
              orchestrator: "claude_agent_sdk",
            } as AccumulatedChunk);
          }
          updateStreamingMessage();
        } else if (parsed.type === "clarification_needed") {
          // Agent is requesting user clarification
          finalizeChunk();

          const clarificationData: ClarificationData = {
            question: parsed.question || "",
            options: parsed.options || [],
            context: parsed.context,
            allowFreeText: parsed.allow_free_text !== false,
            subtaskId: parsed.subtask_id,
            subtaskDescription: parsed.subtask_description,
            subagentName: parsed.subagent_name,
            subagentRole: parsed.subagent_role,
          };

          // Add clarification chunk
          chunks.push({
            type: "clarification_needed",
            content: clarificationData.question,
            clarificationData,
            subtaskId: parsed.subtask_id,
          });

          pendingClarification = clarificationData;

          // Set as message body so user sees the question
          if (!assistantContent) {
            assistantContent = clarificationData.question;
          }

          updateStreamingMessage();
        } else if (parsed.type === "assistant_complete") {
          finalizeChunk();
          receivedComplete = true;

          const finalContent =
            parsed.message?.text_content || assistantContent;
          const finalId = parsed.message?.id;
          const sources = parsed.message?.metadata?.sources;

          const elapsedSeconds = (Date.now() - streamStartTime) / 1000;
          callbacks.onComplete(
            assistantMsgId,
            finalContent,
            finalId,
            chunks as unknown as StreamingChunk[],
            suggestedActions,
            sources,
            pendingClarification,
            elapsedSeconds
          );
          assistantContent = finalContent;
          if (finalId) assistantMsgId = finalId;
          break;
        } else if (
          parsed.type === "client_tool_invocation" &&
          parsed.invocation &&
          callbacks.onToolInvocation
        ) {
          // Execute async — don't block the stream
          callbacks.onToolInvocation(parsed.invocation);
        } else if (parsed.type === "error") {
          throw new Error(parsed.error || "Stream error");
        } else if (parsed.type === "done") {
          // Fallback: if stream ended without assistant_complete (e.g. clarification early return),
          // finalize the message so the frontend still shows it properly
          if (assistantMsgId && !receivedComplete) {
            finalizeChunk();
            const elapsedSecondsDone = (Date.now() - streamStartTime) / 1000;
            callbacks.onComplete(
              assistantMsgId,
              assistantContent || "",
              parsed.message_id,
              chunks as unknown as StreamingChunk[],
              suggestedActions,
              undefined,
              pendingClarification,
              elapsedSecondsDone
            );
          } else if (parsed.message_id && assistantMsgId) {
            callbacks.onMessageUpdate({
              id: assistantMsgId,
              isStreaming: false,
            });
          }
          if (parsed.message_id) assistantMsgId = parsed.message_id;
          break;
        }
      } catch (e) {
        // If it's a real error (not JSON parse), re-throw
        if (e instanceof Error && e.message !== "Stream error") {
          // Check if this is a thrown stream error vs JSON parse error
          if (
            e.message.startsWith("Stream error") ||
            e.message.startsWith("HTTP error")
          ) {
            throw e;
          }
        }
        // Skip invalid JSON lines
      }
    }
  }

  return { assistantMsgId, assistantContent };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useMiiflowChat(config: MiiflowChatConfig): MiiflowChatResult {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );
  const [session, setSession] = useState<EmbedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  // Refs for mutable state — allows stable callback references
  // that always read the latest values (fixes stale closure in widget bridge)
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  const toolHandlersRef = useRef(new Map<string, ToolHandler>());
  const toolDefinitionsRef = useRef(
    new Map<string, Omit<ClientToolDefinition, "handler">>()
  );


  // Initialize session on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const sess = await initSession(configRef.current);
        if (!cancelled) {
          setSession(sess);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to initialize"
          );
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [config.publicKey, config.assistantId]);

  // Derive branding
  const branding = useMemo(() => mapSessionBranding(session), [session]);
  const brandingCSSVars = useBrandingCSSVars(branding);

  // Upload file — store metadata for attaching to user messages
  const uploadedAttachmentsRef = useRef(new Map<string, import("../types").Attachment>());

  // Upload file — uses sessionRef for stable reference
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const currentSession = sessionRef.current;
      if (!currentSession) throw new Error("Not initialized");
      const attachmentId = await uploadFileToBackend(configRef.current, currentSession, file);
      uploadedAttachmentsRef.current.set(attachmentId, {
        id: attachmentId,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        isImage: file.type.startsWith("image/"),
        isVideo: file.type.startsWith("video/"),
        isDocument: !file.type.startsWith("image/") && !file.type.startsWith("video/"),
      });
      return attachmentId;
    },
    [], // stable — reads sessionRef
  );

  // Remove uploaded attachment metadata (called when user removes attachment before sending)
  const removeUploadedAttachment = useCallback((attachmentId: string) => {
    uploadedAttachmentsRef.current.delete(attachmentId);
  }, []);

  // Handle tool invocation from backend. Returns true if handled locally.
  // Uses sessionRef for stable reference — safe to capture in widget bridge.
  const handleToolInvocation = useCallback(
    async (invocation: ToolInvocationRequest): Promise<boolean> => {
      const currentSession = sessionRef.current;
      if (!currentSession) throw new Error("Not initialized");

      const { invocation_id, tool_name, parameters } = invocation;
      console.log(`[Miiflow] Tool invocation received: "${tool_name}" (id: ${invocation_id})`);
      const handler = toolHandlersRef.current.get(tool_name);

      if (!handler) {
        // No local handler — let caller try fallback / sibling widgets
        return false;
      }

      try {
        const result = await Promise.race([
          handler(parameters),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Tool execution timeout (30s)")),
              30000
            )
          ),
        ]);

        console.log(`[Miiflow] Tool "${tool_name}" executed successfully (id: ${invocation_id})`);
        await sendToolResult(configRef.current, currentSession, {
          invocation_id,
          result,
        });
        console.log(`[Miiflow] Tool result sent for "${tool_name}" (id: ${invocation_id})`);
        return true;
      } catch (error) {
        console.error(
          `[Miiflow] Tool '${tool_name}' execution failed:`,
          error
        );
        await sendToolResult(configRef.current, currentSession, {
          invocation_id,
          error: error instanceof Error ? error.message : String(error),
        });
        return true; // Handler existed but threw — still "handled"
      }
    },
    [] // stable — reads sessionRef
  );

  // WebSocket connection for client tool invocations
  useEffect(() => {
    if (!session) return;

    const currentSession = session; // capture non-null for closure

    let ws: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const url = buildWebSocketUrl(configRef.current, currentSession);
      ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[Miiflow] WebSocket connected");
        reconnectAttempt = 0;

        // Start heartbeat
        heartbeatTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, WS_HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "client_tool_invocation" && data.invocation) {
            handleToolInvocation(data.invocation).then(async (handled) => {
              if (!handled) {
                const fallback = configRef.current.onToolInvocationFallback;
                const fallbackHandled = fallback ? await fallback(data.invocation) : false;
                if (!fallbackHandled) {
                  // Send error back to backend so it doesn't hang waiting for result
                  sendToolResult(configRef.current, currentSession, {
                    invocation_id: data.invocation.invocation_id,
                    error: `No handler found for tool '${data.invocation.tool_name}'`,
                  }).catch(console.error);
                }
              }
            }).catch(console.error);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }

        if (!disposed) {
          const delay = Math.min(
            WS_RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempt),
            WS_RECONNECT_MAX_DELAY,
          );
          reconnectAttempt++;
          console.log(`[Miiflow] WebSocket closed, reconnecting in ${delay}ms`);
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = (err) => {
        console.error("[Miiflow] WebSocket error:", err);
      };
    }

    connect();

    return () => {
      disposed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnect on intentional close
        ws.close();
      }
    };
  }, [session, handleToolInvocation]);

  // Send system event — uses sessionRef for stable reference
  const sendSystemEvent = useCallback(
    async (event: SystemEvent): Promise<void> => {
      const currentSession = sessionRef.current;
      if (!currentSession) throw new Error("Not initialized");
      await sendSystemEventToBackend(configRef.current, currentSession, event);
    },
    [] // stable — reads sessionRef
  );

  // Send message — uses refs for stable reference, safe to capture in widget bridge.
  // Also fixes: allows attachment-only messages (empty text with attachmentIds).
  const sendMessage = useCallback(
    async (content: string, attachmentIds?: string[]) => {
      const currentSession = sessionRef.current;
      const hasText = !!content.trim();
      const hasAttachments = attachmentIds && attachmentIds.length > 0;

      if ((!hasText && !hasAttachments) || isStreamingRef.current || !currentSession) return;

      const optimisticId = `msg-${Date.now()}`;

      const messageAttachments = attachmentIds
        ?.map((id) => uploadedAttachmentsRef.current.get(id))
        .filter(Boolean) as import("../types").Attachment[] | undefined;

      const userMessage: InternalMessage = {
        id: optimisticId,
        textContent: content,
        participant: {
          id: "user",
          name: configRef.current.userName || "You",
          role: "user",
        },
        createdAt: new Date().toISOString(),
        attachments: messageAttachments?.length ? messageAttachments : undefined,
      };

      // Clean up stored attachment metadata
      attachmentIds?.forEach((id) => uploadedAttachmentsRef.current.delete(id));

      // Add placeholder assistant message to show loading dots immediately
      const placeholderAssistantId = `assistant-pending-${Date.now()}`;
      const placeholderAssistant: InternalMessage = {
        id: placeholderAssistantId,
        textContent: "",
        participant: {
          id: "assistant",
          name:
            currentSession.config.branding?.custom_name ||
            currentSession.config.assistant_name,
          role: "assistant",
          avatarUrl: currentSession.config.branding?.assistant_avatar,
        },
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, placeholderAssistant]);
      setIsStreaming(true);
      setStreamingMessageId(placeholderAssistantId);

      // Notify consumer that a user message was created (for widget event emission)
      configRef.current.onUserMessageCreated?.({ id: optimisticId, content });

      try {
        const backendBaseUrl = getBackendBaseUrl(configRef.current);

        const response = await fetch(
          `${backendBaseUrl}/assistant/message/stream/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentSession.token}`,
              "x-mii-user-id": getOrCreateUserId(),
            },
            body: JSON.stringify({
              thread_id: currentSession.config.thread_id,
              text_content: content,
              message_id: optimisticId,
              metadata: {},
              attachment_ids: attachmentIds || [],
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const result = await parseSSEStream(
          reader,
          currentSession,
          optimisticId,
          {
            onMessageCreate: (msg) => {
              setStreamingMessageId(msg.id);
              // Replace placeholder with real streaming message
              setMessages((prev) => {
                const filtered = prev.filter(
                  (m) => m.id !== placeholderAssistantId
                );
                return [...filtered, msg];
              });
            },
            onMessageUpdate: (update) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === update.id ? { ...msg, ...update } : msg
                )
              );
            },
            onUserMessageIdUpdate: (oldId, newId) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === oldId ? { ...msg, id: newId } : msg
                )
              );
            },
            onComplete: (
              assistantMsgId,
              finalContent,
              finalId,
              chunks,
              suggestedActions,
              sources,
              pendingClarification,
              executionTime
            ) => {
              if (assistantMsgId) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          id: finalId || msg.id,
                          textContent: finalContent,
                          isStreaming: false,
                          reasoning: chunks,
                          suggestedActions,
                          citations: sources,
                          pendingClarification,
                          executionTime,
                        }
                      : msg
                  )
                );
              }

              // Notify consumer that assistant message is complete (for widget event emission)
              configRef.current.onAssistantMessageComplete?.({
                id: finalId || assistantMsgId || "",
                content: finalContent,
              });
            },
            onToolInvocation: async (invocation) => {
              const handled = await handleToolInvocation(invocation);
              if (!handled) {
                const fallback = configRef.current.onToolInvocationFallback;
                const fallbackHandled = fallback ? await fallback(invocation) : false;
                if (!fallbackHandled) {
                  const sess = sessionRef.current;
                  if (sess) {
                    await sendToolResult(configRef.current, sess, {
                      invocation_id: invocation.invocation_id,
                      error: `No handler found for tool '${invocation.tool_name}'`,
                    });
                  }
                }
              }
            },
          }
        );

        // Ensure streaming is marked complete
        if (result.assistantMsgId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === result.assistantMsgId
                ? { ...msg, isStreaming: false }
                : msg
            )
          );
        }
      } catch (err) {
        console.error("[Miiflow] Send error:", err);

        const sess = sessionRef.current;
        const errorMsg: InternalMessage = {
          id: `error-${Date.now()}`,
          textContent: "Sorry, I encountered an error. Please try again.",
          participant: {
            id: "assistant",
            name:
              sess?.config.branding?.custom_name ||
              sess?.config.assistant_name || "Assistant",
            role: "assistant",
            avatarUrl: sess?.config.branding?.assistant_avatar,
          },
          createdAt: new Date().toISOString(),
        };
        // Remove placeholder and add error message
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== placeholderAssistantId),
          errorMsg,
        ]);
        setError(err instanceof Error ? err.message : "Send failed");
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    },
    [handleToolInvocation] // stable — reads sessionRef and isStreamingRef
  );

  // Start new thread — uses sessionRef for stable reference
  const startNewThread = useCallback(async (): Promise<string> => {
    const currentSession = sessionRef.current;
    if (!currentSession) throw new Error("Not initialized");

    const result = await createThread(configRef.current, currentSession);
    if (!result.token) {
      console.warn("[Miiflow] CreateThread did not return new token — tools may register to wrong thread");
    }
    const updatedSession: EmbedSession = {
      ...currentSession,
      config: { ...currentSession.config, thread_id: result.threadId },
      token: result.token || currentSession.token,
    };
    // Update ref synchronously so that any calls made immediately after
    // startNewThread (e.g. registerTools) use the new session/token.
    // setSession alone is async (React batches state updates) and won't
    // update sessionRef until the next render, causing a race condition
    // where tools get registered on the OLD thread.
    sessionRef.current = updatedSession;
    setSession(updatedSession);
    setMessages([]);

    // Re-register tools on new thread
    if (toolDefinitionsRef.current.size > 0) {
      console.log(`[Miiflow] Re-registering ${toolDefinitionsRef.current.size} tools on new thread`);
      try {
        await registerToolsOnBackend(
          configRef.current,
          updatedSession,
          Array.from(toolDefinitionsRef.current.values())
        );
      } catch (err) {
        console.warn("[Miiflow] Failed to re-register tools:", err);
      }
    }

    return result.threadId;
  }, []); // stable — reads sessionRef

  // Register tool — uses sessionRef for stable reference
  const registerTool = useCallback(
    async (tool: ClientToolDefinition): Promise<void> => {
      const currentSession = sessionRef.current;
      if (!currentSession) throw new Error("Not initialized");

      validateToolDefinition(tool);

      toolHandlersRef.current.set(tool.name, tool.handler);
      const serialized = serializeToolDefinition(tool);
      toolDefinitionsRef.current.set(tool.name, serialized);

      try {
        await registerToolsOnBackend(configRef.current, currentSession, [serialized]);
        console.log(`[Miiflow] Tool registered: "${tool.name}"`);
      } catch (err) {
        toolHandlersRef.current.delete(tool.name);
        toolDefinitionsRef.current.delete(tool.name);
        throw err;
      }
    },
    [] // stable — reads sessionRef
  );

  // Register multiple tools — sends all definitions in a single batch request
  // (matching old MUI implementation behavior). Falls back to one-by-one if
  // only one tool is provided.
  const registerTools = useCallback(
    async (tools: ClientToolDefinition[]): Promise<void> => {
      const currentSession = sessionRef.current;
      if (!currentSession) throw new Error("Not initialized");

      // Validate all tools first before making any changes
      for (const tool of tools) {
        validateToolDefinition(tool);
      }

      // Store handlers and definitions locally
      const previousHandlers = new Map(toolHandlersRef.current);
      const previousDefinitions = new Map(toolDefinitionsRef.current);

      const serializedTools: Array<Omit<ClientToolDefinition, "handler">> = [];
      for (const tool of tools) {
        toolHandlersRef.current.set(tool.name, tool.handler);
        const serialized = serializeToolDefinition(tool);
        toolDefinitionsRef.current.set(tool.name, serialized);
        serializedTools.push(serialized);
      }

      try {
        // Send all tool definitions in one batch request
        await registerToolsOnBackend(configRef.current, currentSession, serializedTools);
        const toolNames = tools.map(t => t.name);
        console.log(`[Miiflow] Tools registered: ${JSON.stringify(toolNames)} (${tools.length} tools)`);
      } catch (err) {
        // Rollback all handlers and definitions on failure
        toolHandlersRef.current = previousHandlers;
        toolDefinitionsRef.current = previousDefinitions;
        throw err;
      }
    },
    [] // stable — reads sessionRef
  );

  // Convert internal messages to ChatMessage format
  const chatMessages: ChatMessage[] = useMemo(
    () =>
      messages.map((msg) => ({
        id: msg.id,
        textContent: msg.textContent?.replace(/\[ref:[^\]]+\]/g, '') || msg.textContent,
        participant: msg.participant,
        createdAt: msg.createdAt,
        isStreaming: msg.isStreaming,
        reasoning: msg.reasoning,
        suggestedActions: msg.suggestedActions,
        citations: msg.citations,
        attachments: msg.attachments,
        pendingClarification: msg.pendingClarification,
        executionTime: msg.executionTime,
      })),
    [messages]
  );

  // Allow external session updates (e.g. token refresh from widget class)
  const updateSession = useCallback((newSession: EmbedSession) => {
    setSession(newSession);
  }, []);

  return {
    messages: chatMessages,
    isStreaming,
    streamingMessageId,
    sendMessage,
    uploadFile,
    removeUploadedAttachment,
    session,
    loading,
    error,
    branding,
    brandingCSSVars,
    startNewThread,
    registerTool,
    registerTools,
    sendSystemEvent,
    handleToolInvocation,
    updateSession,
  };
}
