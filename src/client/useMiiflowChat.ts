/**
 * useMiiflowChat - React hook for connecting to Miiflow's embedded chat API.
 *
 * Handles session init, SSE streaming, message management, tool registration,
 * and branding. Returns a shape directly compatible with ChatProvider props.
 */

import { updateTranscript, type AgentTranscript } from "../types/transcript";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type {
  ChatMessage,
  ParticipantRole,
  StreamingChunk,
  ClarificationData,
  ProgressData,
  SubagentChunkData,
} from "../types";
import type { BrandingData } from "../types/branding";
import { deliveredMedia, useMediaDelivery } from "./use-media-delivery";
import { withReferencedMedia, normalizeMedia, upsertMedia } from "../utils/media";
import { findToolChunkIndex } from "./tool-chunk-matching";
import { createCommitScheduler, type ScheduleFn } from "./frame-scheduler";
import { stripCitationMarkers } from "../utils/citations";
import type {
  MiiflowChatConfig,
  MiiflowChatResult,
  EmbedSession,
  EmbedSessionBranding,
  ClientToolDefinition,
  ToolHandler,
  ToolInvocationRequest,
  SystemEvent,
  PageContext,
} from "./types";
import {
  initSession,
  refreshSessionToken,
  sessionWithRefreshedToken,
  getBackendBaseUrl,
  getOrCreateUserId,
  createThread,
  registerToolsOnBackend,
  uploadFile as uploadFileToBackend,
  sendSystemEvent as sendSystemEventToBackend,
  sendPageContext as sendPageContextToBackend,
  sendToolResult,
  loadCachedSession,
  saveCachedSession,
  clearCachedSession,
} from "./session";
import {
  fetchOrNetworkError,
  HttpError,
  isTransientFailure,
  toNetworkError,
} from "./network";
import { describeInitFailure, describeSendFailure } from "./failure-text";
import { TOKEN_REFRESH_LEAD_MS, isTokenExpiringSoon } from "./token-utils";
import { validateToolDefinition, serializeToolDefinition } from "./tool-validator";
import { useBrandingCSSVars } from "../hooks/use-branding-css-vars";
import { compressImageIfNeeded } from "../utils/compress-image";

// ============================================================================
// WebSocket helpers
// ============================================================================

const WS_HEARTBEAT_INTERVAL = 21000; // 21 seconds — matches web app
const WS_RECONNECT_BASE_DELAY = 1000;
const WS_RECONNECT_MAX_DELAY = 30000;
// A browser reports a rejected websocket handshake and an unreachable server
// identically (close before open, code 1006). After this many consecutive
// handshake failures the token endpoint is asked instead: it answers over
// plain HTTP, so it can tell the network, a bad session, and a healthy
// session whose socket still won't open apart. An expiring token skips the
// wait and is refreshed on the first failure.
const WS_FAILURES_BEFORE_SESSION_CHECK = 3;
// Stop after this many session checks that came back healthy while the
// socket still would not open, so a permanently-broken tab doesn't hammer the
// server forever. A check that could not reach the server does not count.
const WS_MAX_SESSION_CHECKS = 3;
const WS_MIIFLOW_PROTOCOL = "miiflow.v1";

/** Backoff for retrying a session init that failed transiently. */
const INIT_RETRY_BASE_DELAY = 1000;
const INIT_RETRY_MAX_DELAY = 30000;

/** Exponential backoff: `base`, doubling per attempt, capped at `max`. */
function backoffDelay(base: number, max: number, attempt: number): number {
  return Math.min(base * Math.pow(2, attempt), max);
}

function assistantDisplayName(session: EmbedSession | null): string | undefined {
  return session?.config.branding?.custom_name || session?.config.assistant_name;
}

function assistantParticipant(session: EmbedSession | null): InternalMessage["participant"] {
  return {
    id: "assistant",
    name: assistantDisplayName(session) || "Assistant",
    role: "assistant",
    avatarUrl: session?.config.branding?.assistant_avatar,
  };
}

function assistantErrorMessage(
  session: EmbedSession | null,
  text: string
): InternalMessage {
  return {
    id: `error-${Date.now()}`,
    textContent: text,
    participant: assistantParticipant(session),
    createdAt: new Date().toISOString(),
  };
}

function buildWebSocketUrl(config: MiiflowChatConfig, session: EmbedSession): string {
  if (config.webSocketUrl) {
    const url = new URL(config.webSocketUrl);
    url.pathname = `/ws/assistant/thread/${session.config.thread_id}/`;
    url.searchParams.set("role", "user");
    url.searchParams.set("user_id", getOrCreateUserId());
    return url.toString();
  }

  const baseUrl = getBackendBaseUrl(config);
  // Strip /api suffix to get host origin, then convert protocol
  const origin = baseUrl.replace(/\/api$/, "");
  const wsOrigin = origin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  const userId = getOrCreateUserId();
  return `${wsOrigin}/ws/assistant/thread/${session.config.thread_id}/?role=user&user_id=${encodeURIComponent(userId)}`;
}

function buildWebSocketProtocols(session: EmbedSession): string[] {
  // Token travels in Sec-WebSocket-Protocol so it never appears in URLs or
  // access logs. Server echoes back only WS_MIIFLOW_PROTOCOL.
  return [WS_MIIFLOW_PROTOCOL, `embed-token.${session.token}`];
}

// ============================================================================
// Internal types
// ============================================================================

interface InternalMessage {
  /** Minted client-side before the request leaves and never replaced. It is
   *  the identity React keys on; the server's id lands in `serverId`. */
  id: string;
  /** The persisted id the server assigned, once known. */
  serverId?: string;
  /** Server setup status ("Getting started…") for the pre-first-token window;
   *  only ever set on the streaming assistant message, cleared by content. */
  statusText?: string;
  textContent: string;
  participant: {
    id: string;
    name: string;
    role: ParticipantRole;
    avatarUrl?: string;
  };
  createdAt: string;
  isStreaming?: boolean;
  /** The server's message metadata, carried whole so late additions reach the
   *  renderer without a new field here each time. `Message` reads
   *  `turn_outcome` from it. */
  metadata?: Record<string, unknown>;
  reasoning?: StreamingChunk[];
  suggestedActions?: Array<{ id: string; label: string; value: string }>;
  citations?: import("../types").SourceReference[];
  attachments?: import("../types").Attachment[];
  pendingClarification?: ClarificationData;
  pendingToolApproval?: import("../types").ToolApprovalData;
  /** Renders resolved against the `[VIZ:id]` markers in `textContent` */
  visualizations?: import("../types").VisualizationChunkData[];
  /** Media items (images/videos) for inline rendering */
  medias?: import("../types").MediaChunkData[];
  /** Downloadable artifacts (PDF, HTML, ...) produced by tool calls */
  artifacts?: import("../types").ArtifactChunkData[];
  /** Wall-clock execution time in seconds, persisted after streaming completes */
  executionTime?: number;
}

type ChunkType =
  | "answer"
  | "thinking"
  | "tool"
  | "observation"
  | "planning"
  | "progress"
  | "clarification_needed"
  | "tool_approval_needed"
  // Sub-assistant (nested rendering via dispatch_assistant)
  | "subagent";

interface AccumulatedChunk {
  type: string;
  content: string;
  toolName?: string;
  toolDescription?: string;
  status?: string;
  success?: boolean;
  subtaskId?: number;
  clarificationData?: ClarificationData;
  toolArgs?: Record<string, unknown>;
  progress?: ProgressData;
  toolUseId?: string;
  toolCallId?: string;
  /** Epoch ms; mirrors StreamingChunk so the render layer gets durations. */
  startedAt?: number;
  endedAt?: number;
  /** Server-declared side-effect status; undefined means undeclared, not read. */
  toolWrites?: boolean;
  // Sub-assistant nested rendering
  subagentData?: SubagentChunkData;
}

// ============================================================================
// Branding mapper
// ============================================================================

function mapBranding(
  b: EmbedSessionBranding | null | undefined
): BrandingData | null {
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

function mapSessionBranding(
  session: EmbedSession | null
): BrandingData | null {
  return mapBranding(session?.config.branding);
}

// ============================================================================
// SSE stream parser
// ============================================================================

/**
 * Top-level SSE frame types `parseSSEStream` acts on.
 *
 * This is the client half of a contract the server states in
 * `server/assistant/sse_converters.py::SSE_EVENT_TYPES`; a test pins the two
 * together so a frame type added on the server cannot be silently dropped
 * here. It was dropping `visualization` that made `[VIZ:…]` markers surface
 * as raw text in every non-first-party build.
 */
export const HANDLED_STREAM_EVENT_TYPES = [
  "assistant_chunk",
  "transcript_block",
  "subagent_dispatch",
  "clarification_needed",
  "tool_approval_needed",
  "media",
  "visualization",
  "artifact",
  "assistant_complete",
  "client_tool_invocation",
  "error",
  "done",
] as const;

/** Everything the parser knows once the turn has finished. An object rather
 *  than a positional list: it already carried nine arguments, and the next
 *  field added positionally is the next one a caller silently drops. */
interface StreamCompletion {
  assistantMsgId: string;
  finalContent: string;
  finalId?: string;
  chunks?: StreamingChunk[];
  suggestedActions?: Array<{ id: string; label: string; value: string }>;
  sources?: any[];
  visualizations?: import("../types").VisualizationChunkData[];
  artifacts?: import("../types").ArtifactChunkData[];
  pendingClarification?: ClarificationData;
  executionTime?: number;
  pendingToolApproval?: import("../types").ToolApprovalData;
  /** The server's message metadata, carried whole.
   *
   *  Previously three keys were plucked out of it (`sources`,
   *  `visualizations`, `artifacts`) and the rest dropped, so anything the
   *  server added later — `turn_outcome`, which tells the reasoning panel
   *  whether an open tool finished or was abandoned — could not reach the
   *  renderer on the published package's path, only the first-party app's. */
  metadata?: Record<string, unknown>;
}

/** The two ids the hook mints before the request leaves: the optimistic user
 *  message and the assistant placeholder. Both are STABLE — the parser writes
 *  into them and never replaces them, so a host keying rows on `id` keeps one
 *  element from first token to completion. Server-assigned ids are reported
 *  separately, as `serverId`. Replacing the placeholder with a freshly minted
 *  message on the first frame, and then renaming it to the server id at
 *  completion, remounted every message twice per turn — the second time as the
 *  hard cut from live reasoning steps to the finished answer. */
interface StreamMessageIds {
  optimisticId: string;
  assistantMsgId: string;
}

interface StreamParseCallbacks {
  onMessageUpdate: (msg: Partial<InternalMessage> & { id: string }) => void;
  /** The server has named the persisted row for the optimistic user message. */
  onUserMessagePersisted: (optimisticId: string, serverId: string) => void;
  onComplete: (completion: StreamCompletion) => void;
  onToolInvocation?: (invocation: ToolInvocationRequest) => void;
  /** Server setup status line ("Getting started…") for the pre-first-token
   *  window; null clears it. Optional — older consumers ignore it. */
  onStatusUpdate?: (text: string | null) => void;
}

/** Exported for tests only — deliberately NOT re-exported from
 *  `client/index.ts`, so it stays off the package's public API. Driving it
 *  directly is the only way to assert what a recorded stream produces without
 *  a DOM. */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ids: StreamMessageIds,
  callbacks: StreamParseCallbacks,
  options: { schedule?: ScheduleFn } = {}
): Promise<{ assistantMsgId: string | null; assistantContent: string }> {
  const { optimisticId, assistantMsgId } = ids;
  const decoder = new TextDecoder();
  const streamStartTime = Date.now();
  let assistantContent = "";
  let transcript: AgentTranscript | undefined;
  // Set once any frame has written into the assistant message. The hook uses
  // it to tell "this turn produced nothing" from "this turn produced an empty
  // answer": the former drops the placeholder, the latter finalizes it.
  let messageTouched = false;
  let userMessagePersisted = false;
  const chunks: AccumulatedChunk[] = [];
  let suggestedActions:
    | Array<{ id: string; label: string; value: string }>
    | undefined;
  let pendingClarification: ClarificationData | undefined;
  let pendingToolApproval: import("../types").ToolApprovalData | undefined;
  let mediaItems: import("../types").MediaChunkData[] = [];
  // Renders and downloadable files produced by tool calls in this turn. Their
  // ids are content-derived server-side, so an identical re-render arrives
  // under the SAME id and must replace rather than append — the server's own
  // accumulator (`_record_visualization`) does the same.
  let vizItems: import("../types").VisualizationChunkData[] = [];
  let artifactItems: import("../types").ArtifactChunkData[] = [];
  let receivedComplete = false;

  // Chunk accumulation state
  let currentChunkType: ChunkType = "answer";
  let currentChunkContent = "";
  let currentToolName: string | undefined;
  let currentToolDescription: string | undefined;
  let currentSuccess: boolean | undefined;
  let currentToolStatus: "planned" | "executing" | "completed" | undefined;
  let currentSubtaskId: number | undefined;
  let currentToolArgs: Record<string, unknown> | undefined;
  let currentProgress: ProgressData | undefined;
  let currentChunkStartedAt: number | undefined;

  let lineBuffer = "";

  // Wall clock of the SSE frame being processed, in epoch ms. The server stamps
  // every frame with `ts` (float seconds); arrival time is the fallback for a
  // server that predates it. Durations are always a DIFFERENCE of two of these,
  // so client clock skew and network latency both cancel.
  let frameTimeMs = Date.now();
  const readFrameTime = (frame: { ts?: unknown }): number =>
    typeof frame?.ts === "number" ? frame.ts * 1000 : Date.now();

  /** Append, or replace in place when an entry with the same id is present. */
  const upsertById = <T extends { id: string }>(list: T[], item: T): T[] => {
    const idx = list.findIndex((existing) => existing.id === item.id);
    if (idx === -1) return [...list, item];
    const next = list.slice();
    next[idx] = item;
    return next;
  };

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
        toolArgs: currentToolArgs,
        progress: currentProgress,
        startedAt: currentChunkStartedAt,
        endedAt: frameTimeMs,
      });
      currentChunkContent = "";
      currentToolName = undefined;
      currentToolDescription = undefined;
      currentSuccess = undefined;
      currentToolStatus = undefined;
      currentSubtaskId = undefined;
      currentToolArgs = undefined;
      currentProgress = undefined;
      currentChunkStartedAt = undefined;
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
        toolArgs: currentToolArgs,
        progress: currentProgress,
        startedAt: currentChunkStartedAt,
        // No endedAt: the chunk is still open, which is what renders it running.
      });
    }
    return display;
  };

  // One `onMessageUpdate` per animation frame, however many frames arrived
  // in it. The accumulators above are the source of truth; a commit is a
  // snapshot of them, so frame order can never be inverted by batching.
  const commitStreamingMessage = () => {
    callbacks.onMessageUpdate({
      id: assistantMsgId,
      textContent: assistantContent,
      reasoning: buildDisplayChunks(),
      ...(transcript ? { metadata: { transcript } } : {}),
      suggestedActions,
      visualizations: vizItems.length > 0 ? vizItems : undefined,
      medias: mediaItems.length > 0 ? mediaItems : undefined,
      artifacts: artifactItems.length > 0 ? artifactItems : undefined,
      // Content has started arriving; the setup status line is over.
      statusText: undefined,
    });
  };
  const scheduler = createCommitScheduler(commitStreamingMessage, options.schedule);
  const updateStreamingMessage = () => {
    messageTouched = true;
    scheduler.request();
  };

  try {
    while (true) {
      // A body that dies mid-stream rejects here with the same bare TypeError
      // as a failed fetch; name it before it is mistaken for a parser bug.
      const { done, value } = await reader.read().catch((err) => {
        throw toNetworkError(err);
      });
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
          frameTimeMs = readFrameTime(parsed);

          if (parsed.type === "transcript_block" && parsed.version === 1) {
            transcript = updateTranscript(transcript, parsed);
            updateStreamingMessage();
            continue;
          }
          if (parsed.type === "assistant_chunk") {
            // Setup status frame: carries no content — surface the text and
            // skip all accumulation (an empty chunk must not create or touch
            // the streaming message).
            if (parsed.is_status_update) {
              scheduler.flushNow();
              callbacks.onStatusUpdate?.(parsed.status_text || null);
              continue;
            }

            // Server retracted optimistically streamed answer text: it was
            // preamble narration before a tool call (or a max_tokens
            // truncation). Clear the answer buffer; the text re-arrives as a
            // thinking chunk. The is_tool_planned clear below stays as a
            // backstop for older servers that don't emit retractions.
            if (parsed.is_answer_retraction) {
              assistantContent = "";
              updateStreamingMessage();
              continue;
            }

            // A tool_use block started streaming: show the pending tool chip
            // immediately — argument generation can run tens of seconds with no
            // other event; the is_tool_planned frame that follows once args are
            // complete merges into this chip by tool_call_id.
            if (parsed.is_tool_streaming) {
              if (currentChunkContent || currentChunkType !== "answer") {
                finalizeChunk();
                currentChunkType = "answer";
              }
              if (findToolChunkIndex(chunks, parsed) < 0) {
                chunks.push({
                  type: "tool",
                  content: "",
                  toolName: parsed.tool_name,
                  toolCallId: parsed.tool_call_id,
                  status: "planned",
                  subtaskId: parsed.subtask_id,
                  toolWrites: parsed.tool_writes,
                  // A tool's clock starts when its block opens — argument
                  // generation is real waiting the user is watching.
                  startedAt: frameTimeMs,
                });
              }
              updateStreamingMessage();
              continue;
            }

            // Handle tool planned
            if (parsed.is_tool_planned) {
              if (currentChunkContent || currentChunkType !== "answer") {
                finalizeChunk();
                currentChunkType = "answer";
              }

              // Any text the model streamed before this tool call was preamble
              // narration for the call ("Let me pull X..."), not part of the
              // final answer. Clear the answer buffer so it doesn't bleed into
              // — and concatenate with — the actual final-answer text streamed
              // on the closing turn. The orchestrator can't know mid-stream
              // whether text is preamble or answer; the tool call announcement
              // is the earliest reliable signal that everything before it on
              // this turn was preamble.
              assistantContent = "";

              // Merge into the chip the is_tool_streaming frame already created.
              // Only by tool_call_id — the name-based fallback could wrongly
              // resurrect a COMPLETED chip for a repeated same-name call on
              // id-less legacy paths, where pushing a fresh chip is correct.
              const plannedIdx = parsed.tool_call_id
                ? findToolChunkIndex(chunks, parsed)
                : -1;
              if (plannedIdx >= 0) {
                chunks[plannedIdx] = {
                  ...chunks[plannedIdx],
                  toolDescription:
                    parsed.tool_description ?? chunks[plannedIdx].toolDescription,
                  status: "planned",
                  // Keep the earlier start from the is_tool_streaming frame.
                  startedAt: chunks[plannedIdx].startedAt ?? frameTimeMs,
                  toolWrites: chunks[plannedIdx].toolWrites ?? parsed.tool_writes,
                };
              } else {
                chunks.push({
                  type: "tool",
                  content: "",
                  toolName: parsed.tool_name,
                  toolCallId: parsed.tool_call_id,
                  toolDescription: parsed.tool_description,
                  status: "planned",
                  subtaskId: parsed.subtask_id,
                  toolWrites: parsed.tool_writes,
                  startedAt: frameTimeMs,
                });
              }
              updateStreamingMessage();
              continue;
            }

            // Handle tool executing
            if (parsed.is_tool_executing) {
              const idx = findToolChunkIndex(chunks, parsed);
              if (idx >= 0) {
                chunks[idx].status = "executing";
                chunks[idx].startedAt ??= frameTimeMs;
                chunks[idx].toolWrites ??= parsed.tool_writes;
              }
              updateStreamingMessage();
              continue;
            }

            // Handle observation
            if (parsed.is_observation) {
              const idx = findToolChunkIndex(chunks, parsed);
              if (idx >= 0) {
                chunks[idx].status = "completed";
                // The observation IS the tool's completion — the only frame
                // that closes a tool's clock.
                chunks[idx].endedAt = frameTimeMs;
                if (parsed.success === false) chunks[idx].success = false;
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

            if (parsed.tool_args) currentToolArgs = parsed.tool_args;
            if (parsed.progress) currentProgress = parsed.progress;

            // Determine chunk type. Subtask/replan/plan-complete branches that
            // existed for the legacy Plan & Execute orchestrator were removed in
            // the unified-ReAct migration; `is_planning` now means
            // `enter_plan_mode`/`exit_plan_mode` and emits a plain text chunk.
            let newChunkType: ChunkType = "answer";
            if (parsed.is_thinking) {
              newChunkType = "thinking";
            } else if (parsed.is_planning) {
              newChunkType = "planning";
            } else if (parsed.is_progress_update) {
              newChunkType = "progress";
            }

            if (newChunkType !== currentChunkType) {
              finalizeChunk();
              currentChunkType = newChunkType;
            }

            // First frame of this chunk opens its clock; finalizeChunk closes it.
            currentChunkStartedAt ??= frameTimeMs;

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

            // The server names the persisted user message on every frame; record
            // it once. It is reported as `serverId`, never written over the
            // optimistic `id` — that id is the row's React key.
            if (parsed.previous_message_id && !userMessagePersisted) {
              userMessagePersisted = true;
              callbacks.onUserMessagePersisted(
                optimisticId,
                parsed.previous_message_id
              );
            }

            updateStreamingMessage();
          } else if (parsed.type === "subagent_dispatch") {
            // Sub-assistant dispatch streaming. The backend fires four sub-events
            // per dispatched child (start, progress*, complete | failed). For a
            // depth-1 dispatch, the path is just [subagent_id] and the chunk
            // lives at the top of `chunks[]`. For nested dispatches, the path
            // is [root_child_id, ..., this_id] — we walk it to place the chunk
            // inside the correct ancestor's `nestedChunks` array.
            const subEvent: string = parsed.sub_event || "";
            const path: string[] =
              Array.isArray(parsed.subagent_path) && parsed.subagent_path.length > 0
                ? (parsed.subagent_path as string[])
                : [parsed.subagent_id || ""];

            // Walk path. Each step either finds the existing chunk for that
            // segment's id, or (only for the final segment on a "start" event)
            // creates a new one.
            let container: AccumulatedChunk[] = chunks;
            let targetChunk: AccumulatedChunk | undefined;
            let pathBroken = false;

            for (let i = 0; i < path.length; i++) {
              const segmentId = path[i];
              const idx = container.findIndex(
                (c) =>
                  c.type === "subagent" &&
                  c.subagentData?.subagentId === segmentId
              );

              if (i === path.length - 1) {
                // Final segment: this is the target.
                if (idx >= 0) {
                  targetChunk = container[idx];
                } else if (subEvent === "start") {
                  const newChunk: AccumulatedChunk = {
                    type: "subagent",
                    content: "",
                    subagentData: {
                      subagentId: segmentId,
                      subagentType: parsed.handle || "",
                      status: "running",
                      result: "",
                      nestedChunks: [],
                      // Which parent step gathered this child. Specialists sharing
                      // it ran concurrently and render as one group.
                      dispatchStep:
                        typeof parsed.dispatch_step === "number" ? parsed.dispatch_step : undefined,
                    },
                  };
                  container.push(newChunk);
                  targetChunk = newChunk;
                } else {
                  // progress/complete/failed for an unknown subagent_id — the
                  // start event was probably dropped. Bail rather than create a
                  // ghost chunk.
                  pathBroken = true;
                }
              } else {
                // Intermediate segment: must already exist.
                if (idx < 0) {
                  pathBroken = true;
                  break;
                }
                // Descend into the intermediate's nestedChunks.
                const inner = container[idx].subagentData;
                if (!inner) {
                  pathBroken = true;
                  break;
                }
                container = inner.nestedChunks as AccumulatedChunk[];
              }
            }

            if (!pathBroken && targetChunk?.subagentData) {
              const data = targetChunk.subagentData;
              if (subEvent === "progress") {
                const chunk = (parsed.chunk as string) || "";
                data.result = (data.result || "") + chunk;
              } else if (subEvent === "retracted") {
                data.result = "";
              } else if (subEvent === "complete") {
                data.status = "completed";
                if (parsed.result) data.result = parsed.result as string;
                if (parsed.duration_ms != null)
                  data.durationMs = parsed.duration_ms as number;
              } else if (subEvent === "failed") {
                data.status = "failed";
                if (parsed.error)
                  data.result =
                    (data.result || "") + `\n\nError: ${parsed.error}`;
                else if (parsed.result) data.result = parsed.result as string;
                if (parsed.duration_ms != null)
                  data.durationMs = parsed.duration_ms as number;
              } else if (subEvent === "thinking") {
                const delta = (parsed.chunk as string) || "";
                if (delta) {
                  const nested = data.nestedChunks as AccumulatedChunk[];
                  const last = nested[nested.length - 1];
                  if (last && last.type === "thinking") {
                    last.content = (last.content || "") + delta;
                  } else {
                    nested.push({ type: "thinking", content: delta });
                  }
                }
              } else if (subEvent === "tool") {
                const toolName = (parsed.tool_name as string) || "";
                const toolDescription = parsed.tool_description as string | undefined;
                const status = (parsed.status as
                  | "planned"
                  | "executing"
                  | "completed") || "planned";
                const nested = data.nestedChunks as AccumulatedChunk[];
                let toolIdx = -1;
                for (let k = nested.length - 1; k >= 0; k--) {
                  if (nested[k].type === "tool" && nested[k].toolName === toolName) {
                    toolIdx = k;
                    break;
                  }
                }
                if (toolIdx >= 0) {
                  nested[toolIdx] = {
                    ...nested[toolIdx],
                    status,
                    toolDescription:
                      toolDescription || nested[toolIdx].toolDescription,
                  };
                } else {
                  nested.push({
                    type: "tool",
                    content: "",
                    toolName,
                    toolDescription,
                    status,
                  });
                }
              } else if (subEvent === "observation") {
                const toolName = (parsed.tool_name as string) || "";
                const success = parsed.success !== false;
                const obsText = (parsed.chunk as string) || "";
                const nested = data.nestedChunks as AccumulatedChunk[];
                for (let k = nested.length - 1; k >= 0; k--) {
                  if (nested[k].type === "tool" && nested[k].toolName === toolName) {
                    nested[k] = {
                      ...nested[k],
                      status: "completed",
                      success,
                    };
                    break;
                  }
                }
                nested.push({
                  type: "observation",
                  content: obsText,
                  toolName,
                  success,
                });
              }
            }
            updateStreamingMessage();
          } else if (parsed.type === "clarification_needed") {
            // Agent is requesting user clarification
            finalizeChunk();

            const clarificationData: ClarificationData = {
              questions: (parsed.questions as ClarificationData["questions"]) || [],
              context: parsed.context,
              subtaskId: parsed.subtask_id,
              subtaskDescription: parsed.subtask_description,
              subagentName: parsed.subagent_name,
              subagentRole: parsed.subagent_role,
              toolCallId: parsed.tool_call_id,
              interruptId: parsed.interrupt_id,
              // legacy single-question tolerance for old streams/history
              question: (parsed.question as string) || undefined,
              options: (parsed.options as string[]) || undefined,
            };

            // Display string: prefer shared context, else the first question.
            const clarificationText =
              clarificationData.context ||
              clarificationData.questions?.[0]?.question ||
              clarificationData.question ||
              "";

            // Add clarification chunk
            chunks.push({
              type: "clarification_needed",
              content: clarificationText,
              clarificationData,
              subtaskId: parsed.subtask_id,
            });

            pendingClarification = clarificationData;

            // Set as message body so user sees the question
            if (!assistantContent) {
              assistantContent = clarificationText;
            }

            updateStreamingMessage();
          } else if (parsed.type === "tool_approval_needed") {
            // Tool requires user approval before execution
            finalizeChunk();

            const toolApprovalData: import("../types").ToolApprovalData = {
              toolName: parsed.tool_name || "",
              toolDescription: parsed.tool_description || "",
              toolInputs: parsed.tool_inputs || {},
              toolSchema: parsed.tool_schema,
              toolCallId: parsed.tool_call_id,
              interruptId: parsed.interrupt_id,
              toolLabel: parsed.tool_label,
              // Opaque host-interpreted preview (e.g. ad-mutation diff). Transported as-is.
              preview: parsed.tool_preview,
            };

            chunks.push({
              type: "tool_approval_needed",
              content: toolApprovalData.toolDescription,
              toolApprovalData,
            } as AccumulatedChunk);

            pendingToolApproval = toolApprovalData;

            updateStreamingMessage();
          } else if (parsed.type === "media") {
            // Media event (image/video) from image generation tools
            const mediaData = parsed.media_data;
            if (mediaData) {
              mediaItems = upsertMedia(mediaItems, normalizeMedia(mediaData));
              updateStreamingMessage();
            }
          } else if (parsed.type === "visualization") {
            // A render tool returned a chart/table/card. The answer text carries
            // a `[VIZ:<id>]` marker; `Message` resolves it against this list.
            const vizData = parsed.visualization_data;
            if (vizData?.id) {
              vizItems = upsertById(vizItems, {
                id: vizData.id,
                type: vizData.type,
                title: vizData.title,
                description: vizData.description,
                data: vizData.data,
                config: vizData.config,
                context: parsed.context,
              });
              updateStreamingMessage();
            }
          } else if (parsed.type === "artifact") {
            // A persisted downloadable file (PDF, HTML, ...) — rendered as an
            // inline card beneath the answer.
            const artifactData = parsed.artifact_data;
            if (artifactData?.id) {
              artifactItems = upsertById(artifactItems, artifactData);
              updateStreamingMessage();
            }
          } else if (parsed.type === "assistant_complete") {
            finalizeChunk();
            receivedComplete = true;
            messageTouched = true;

            const finalContent =
              parsed.message?.text_content || assistantContent;
            const finalId = parsed.message?.id;
            const metadata = transcript || parsed.message?.metadata
              ? { ...(transcript ? { transcript } : {}), ...parsed.message?.metadata }
              : undefined;
            const sources = metadata?.sources;

            // Finalize prunes renders the model left unembedded
            // (`visualization_policy.partition_unembedded_visualizations`), so
            // the persisted list — not what we accumulated live — is what the
            // message actually contains. A server old enough to send no
            // metadata at all is the only case that keeps the streamed lists.
            const finalVisualizations = metadata
              ? metadata.visualizations ?? []
              : vizItems;
            const finalArtifacts = metadata
              ? metadata.artifacts ?? []
              : artifactItems;

            const elapsedSeconds = (Date.now() - streamStartTime) / 1000;
            scheduler.flushNow();
            callbacks.onComplete({
              assistantMsgId,
              finalContent,
              finalId,
              chunks: chunks as unknown as StreamingChunk[],
              suggestedActions,
              sources,
              visualizations: finalVisualizations,
              artifacts: finalArtifacts,
              pendingClarification,
              executionTime: elapsedSeconds,
              pendingToolApproval,
              metadata,
            });
            assistantContent = finalContent;
            break;
          } else if (
            parsed.type === "client_tool_invocation" &&
            parsed.invocation &&
            callbacks.onToolInvocation
          ) {
            // Execute async — don't block the stream
            scheduler.flushNow();
            callbacks.onToolInvocation(parsed.invocation);
          } else if (parsed.type === "error") {
            if (transcript) {
              transcript = { ...transcript, status: "failed" };
              updateStreamingMessage();
            }
            throw new Error(`Stream error: ${parsed.error || "Generation failed"}`);
          } else if (parsed.type === "done") {
            if (transcript?.status === "running") transcript = { ...transcript, status: parsed.transcript_status || "completed" };
            // Fallback: if stream ended without assistant_complete (e.g. clarification early return),
            // finalize the message so the frontend still shows it properly
            if (messageTouched && !receivedComplete) {
              finalizeChunk();
              const elapsedSecondsDone = (Date.now() - streamStartTime) / 1000;
              scheduler.flushNow();
              callbacks.onComplete({
                assistantMsgId,
                finalContent: assistantContent || "",
                finalId: parsed.message_id,
                metadata: transcript ? { transcript } : undefined,
                chunks: chunks as unknown as StreamingChunk[],
                suggestedActions,
                // No `assistant_complete`, so no persisted metadata to prefer —
                // what we accumulated live is all this turn has.
                visualizations: vizItems,
                artifacts: artifactItems,
                pendingClarification,
                executionTime: elapsedSecondsDone,
                pendingToolApproval,
              });
            } else if (parsed.message_id && messageTouched) {
              scheduler.flushNow();
              callbacks.onMessageUpdate({
                id: assistantMsgId,
                serverId: parsed.message_id,
                isStreaming: false,
              });
            }
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

  } catch (error) {
    if (transcript?.status === "running") {
      transcript = { ...transcript, status: error instanceof Error && error.name === "AbortError" ? "stopped" : "failed" };
      updateStreamingMessage();
    }
    throw error;
  } finally {
    if (transcript?.status === "running" && !receivedComplete) {
      transcript = { ...transcript, status: "failed" };
      updateStreamingMessage();
    }
    // Whatever the last frames staged is committed before the caller sees
    // the result; a thrown error still leaves the message consistent.
    scheduler.flushNow();
    scheduler.dispose();
  }

  // `null` when no frame wrote into the message: the hook drops the
  // placeholder instead of finalizing an empty row.
  return {
    assistantMsgId: messageTouched ? assistantMsgId : null,
    assistantContent,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useMiiflowChat(config: MiiflowChatConfig): MiiflowChatResult {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
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

  const abortControllerRef = useRef<AbortController | null>(null);

  const toolHandlersRef = useRef(new Map<string, ToolHandler>());
  const toolDefinitionsRef = useRef(
    new Map<string, Omit<ClientToolDefinition, "handler">>()
  );

  // Branding from the last cached session, applied AFTER mount (never during the
  // first render) so it can't cause an SSR/hydration mismatch. Lets a returning
  // visitor see their real branding instantly without a network round-trip.
  const [cachedBranding, setCachedBranding] =
    useState<EmbedSessionBranding | null>(null);

  // Resolves the session: the in-flight init when there is one, otherwise a
  // fresh attempt (a failed init is retried now instead of waiting out its
  // backoff). sendMessage() awaits it so a message typed before, or after a
  // failed, init is not dropped.
  const ensureSessionRef = useRef<(() => Promise<EmbedSession | null>) | null>(
    null
  );
  // Why the last init failed, so a send that finds no session can say so.
  const initFailureRef = useRef<unknown>(null);
  // The ids of a turn still waiting for its session: shown, but not yet sent.
  const unsentTurnRef = useRef<string[] | null>(null);

  // Initialize session on mount
  useEffect(() => {
    let cancelled = false;
    let resolved: EmbedSession | null = null;
    let inFlight: Promise<EmbedSession | null> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let transientFailures = 0;

    // Surface cached branding immediately (post-mount, no network).
    const cached = loadCachedSession(configRef.current);
    let cachedToken = cached?.token;
    if (cached?.config.branding) {
      setCachedBranding(cached.config.branding);
    }

    // Serialize any tools provided up-front so they can be folded into init.
    // Their handlers are registered locally so backend invocations resolve.
    const configTools = configRef.current.tools ?? [];
    const serializedConfigTools = configTools.map((tool) => {
      validateToolDefinition(tool);
      toolHandlersRef.current.set(tool.name, tool.handler);
      const serialized = serializeToolDefinition(tool);
      toolDefinitionsRef.current.set(tool.name, serialized);
      return serialized;
    });

    async function init(): Promise<EmbedSession | null> {
      try {
        let sess: EmbedSession;
        try {
          sess = await initSession(configRef.current, {
            token: cachedToken,
            tools: serializedConfigTools,
          });
        } catch (err) {
          // A cached token the backend rejects (rotated key, revoked tenant)
          // shouldn't strand the chat — drop it and retry the full handshake.
          // An unreachable or restarting backend rejected nothing, so the
          // token stays.
          if (cachedToken && !isTransientFailure(err)) {
            clearCachedSession(configRef.current);
            cachedToken = undefined;
            sess = await initSession(configRef.current, {
              tools: serializedConfigTools,
            });
          } else {
            throw err;
          }
        }
        if (cancelled) return successorSession();
        resolved = sess;
        transientFailures = 0;
        initFailureRef.current = null;
        saveCachedSession(configRef.current, sess);
        setSession(sess);
        setError(null);
        setLoading(false);

        // Self-heal across deploy ordering: if the backend didn't acknowledge
        // the folded tools (older backend that ignores `tools` in init), register
        // them separately. Non-blocking — the session is already usable.
        if (serializedConfigTools.length > 0) {
          const acked = new Set(sess.registeredTools ?? []);
          const missing = serializedConfigTools.filter(
            (tool) => !acked.has(tool.name)
          );
          if (missing.length > 0) {
            registerToolsOnBackend(configRef.current, sess, missing).catch(
              (err) => {
                console.warn(
                  "[Miiflow] Fallback tool registration failed:",
                  err
                );
              }
            );
          }
        }
        return sess;
      } catch (err) {
        if (cancelled) return successorSession();
        initFailureRef.current = err;
        setLoading(false);
        setError(describeInitFailure(err));
        if (isTransientFailure(err)) {
          // Init is safe to repeat (the backend reuses this visitor's session
          // and its still-empty thread), so an unreachable or restarting
          // backend is waited out rather than left as a dead panel.
          retryTimer = setTimeout(
            ensureSession,
            backoffDelay(INIT_RETRY_BASE_DELAY, INIT_RETRY_MAX_DELAY, transientFailures++)
          );
        }
        return null;
      }
    }

    // A send awaiting this init must not be told "no session" because the
    // effect re-ran (StrictMode, a key change): hand it to the init that
    // replaced this one. After an unmount there is none.
    function successorSession(): Promise<EmbedSession | null> {
      const successor = ensureSessionRef.current;
      return successor && successor !== ensureSession
        ? successor()
        : Promise.resolve(null);
    }

    function ensureSession(): Promise<EmbedSession | null> {
      if (cancelled) return successorSession();
      if (resolved) return Promise.resolve(resolved);
      if (inFlight) return inFlight;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      const run: Promise<EmbedSession | null> = init().finally(() => {
        if (inFlight === run) inFlight = null;
      });
      inFlight = run;
      return run;
    }

    // The OS knows before any backoff timer does.
    const onOnline = () => {
      void ensureSession();
    };

    ensureSessionRef.current = ensureSession;
    window.addEventListener("online", onOnline);
    void ensureSession();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("online", onOnline);
      if (ensureSessionRef.current === ensureSession) ensureSessionRef.current = null;
    };
  }, [config.publicKey, config.assistantId]);

  // Derive branding. Live server branding wins once init resolves; before that,
  // fall back to consumer-provided initialBranding, then the cached branding.
  const branding = useMemo(
    () =>
      mapSessionBranding(session) ??
      config.initialBranding ??
      mapBranding(cachedBranding),
    [session, config.initialBranding, cachedBranding]
  );
  const brandingCSSVars = useBrandingCSSVars(branding);

  // Upload file — store metadata for attaching to user messages
  const uploadedAttachmentsRef = useRef(new Map<string, import("../types").Attachment>());

  // Upload file — uses sessionRef for stable reference
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const currentSession = sessionRef.current;
      if (!currentSession) throw new Error("Not initialized");

      // Compress large images to stay under API base64 size limit (5 MB)
      if (file.type.startsWith("image/")) {
        try {
          file = await compressImageIfNeeded(file);
        } catch (e) {
          console.warn("Image compression failed, using original:", e);
        }
      }

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

  // WebSocket connection for client tool invocations. Keyed on the THREAD, not
  // the session object: a token refresh (this effect's own, or a media-token
  // update) must not tear down a healthy socket or reset the failure counters.
  const wsThreadId = session?.config.thread_id;
  useEffect(() => {
    if (!wsThreadId) return;

    let ws: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let handshakeFailures = 0;
    let sessionChecks = 0;
    let disposed = false;

    function scheduleReconnect() {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(
        connect,
        backoffDelay(WS_RECONNECT_BASE_DELAY, WS_RECONNECT_MAX_DELAY, reconnectAttempt++)
      );
    }

    function connect() {
      reconnectTimer = null;
      if (disposed) return;

      // Always read the latest session — sessionRef may have been refreshed
      // since this effect first ran (token refresh, startNewThread, etc.).
      const sess = sessionRef.current;
      if (!sess) return;

      const url = buildWebSocketUrl(configRef.current, sess);
      const protocols = buildWebSocketProtocols(sess);
      const socket = new WebSocket(url, protocols);
      ws = socket;
      let opened = false;

      socket.onopen = () => {
        console.log("[Miiflow] WebSocket connected");
        opened = true;
        reconnectAttempt = 0;
        handshakeFailures = 0;
        sessionChecks = 0;

        // Start heartbeat
        heartbeatTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, WS_HEARTBEAT_INTERVAL);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "client_tool_invocation" && data.invocation) {
            handleToolInvocation(data.invocation).then(async (handled) => {
              if (!handled) {
                const fallback = configRef.current.onToolInvocationFallback;
                const fallbackHandled = fallback ? await fallback(data.invocation) : false;
                if (!fallbackHandled) {
                  // Send error back to backend so it doesn't hang waiting for result
                  const replySession = sessionRef.current;
                  if (replySession) {
                    sendToolResult(configRef.current, replySession, {
                      invocation_id: data.invocation.invocation_id,
                      error: `No handler found for tool '${data.invocation.tool_name}'`,
                    }).catch(console.error);
                  }
                }
              }
            }).catch(console.error);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (disposed) return;

        // A socket that was open dropped: nothing suggests the session, so
        // just reconnect.
        if (opened) {
          scheduleReconnect();
          return;
        }

        handshakeFailures++;
        const sess = sessionRef.current;
        const checkSession =
          sess &&
          (isTokenExpiringSoon(sess.token, TOKEN_REFRESH_LEAD_MS) ||
            handshakeFailures >= WS_FAILURES_BEFORE_SESSION_CHECK);
        if (!sess || !checkSession) {
          scheduleReconnect();
          return;
        }
        if (sessionChecks >= WS_MAX_SESSION_CHECKS) {
          console.error(
            "[Miiflow] WebSocket giving up: the session is valid but the socket keeps failing",
          );
          return;
        }

        // The refresh endpoint re-issues the token for THIS thread. Init
        // would move a conversation that has messages onto a new, empty
        // thread and drop its client tools.
        const embedConfig = configRef.current;
        refreshSessionToken(getBackendBaseUrl(embedConfig), sess.token, embedConfig.publicKey)
          .then((token) => {
            if (disposed) return;
            const current = sessionRef.current;
            // The conversation moved to another thread while the refresh was
            // on the wire: the socket effect for that thread replaces this one.
            if (!current || current.config.thread_id !== sess.config.thread_id) return;
            sessionChecks++;
            const refreshed = sessionWithRefreshedToken(current, token);
            if (!refreshed) {
              // Still on this thread, but the backend issued the token for
              // another one (a server that re-issues for the session's newest
              // thread, which another tab has since moved). No token for this
              // thread came back, so this check did not help: keep trying
              // until the check cap gives up and says so, rather than going
              // quiet with the socket down.
              scheduleReconnect();
              return;
            }
            handshakeFailures = 0;
            sessionRef.current = refreshed;
            saveCachedSession(embedConfig, refreshed);
            setSession(refreshed);
            scheduleReconnect();
          })
          .catch((err) => {
            if (disposed) return;
            // Unreachable, restarting or rate limited: says nothing about
            // the session, so keep waiting it out.
            if (isTransientFailure(err)) {
              scheduleReconnect();
              return;
            }
            // The backend refused the session itself (revoked, tenant
            // inactive, key mismatch): no token will open this socket.
            console.error("[Miiflow] WebSocket giving up: session rejected", err);
          });
      };

      socket.onerror = () => {
        // Intentionally silent — onerror always precedes onclose,
        // which handles reconnection with exponential backoff.
      };
    }

    // Back online: reconnect now instead of waiting out the backoff. A
    // pending timer means the socket is closed; anything else is either open
    // or already mid-handshake.
    const onOnline = () => {
      if (!reconnectTimer) return;
      reconnectAttempt = 0;
      clearTimeout(reconnectTimer);
      connect();
    };

    window.addEventListener("online", onOnline);
    connect();

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnect on intentional close
        ws.close();
      }
    };
  }, [wsThreadId, handleToolInvocation]);

  // Send system event — uses sessionRef for stable reference
  const sendSystemEvent = useCallback(
    async (event: SystemEvent): Promise<void> => {
      const currentSession = sessionRef.current;
      if (!currentSession) throw new Error("Not initialized");
      await sendSystemEventToBackend(configRef.current, currentSession, event);
    },
    [] // stable — reads sessionRef
  );

  // Send hidden page context — stored in history, not rendered, no auto-reply
  const sendPageContext = useCallback(
    async (context: PageContext): Promise<void> => {
      const currentSession = sessionRef.current;
      if (!currentSession) throw new Error("Not initialized");
      await sendPageContextToBackend(configRef.current, currentSession, context);
    },
    [] // stable — reads sessionRef
  );

  // Send message — uses refs for stable reference, safe to capture in widget bridge.
  // Also fixes: allows attachment-only messages (empty text with attachmentIds).
  const sendMessage = useCallback(
    async (content: string, attachmentIds?: string[], extraMetadata?: Record<string, unknown>) => {
      const hasText = !!content.trim();
      const hasAttachments = attachmentIds && attachmentIds.length > 0;

      if ((!hasText && !hasAttachments) || isStreamingRef.current) return;

      // Lock before anything awaits, so a second send while the session
      // resolves is refused instead of streamed alongside this one.
      isStreamingRef.current = true;

      const optimisticId = `msg-${Date.now()}`;
      const isClarificationResponse = !!extraMetadata?.is_clarification_response;

      const messageAttachments = attachmentIds
        ?.map((id) => uploadedAttachmentsRef.current.get(id))
        .filter(Boolean) as import("../types").Attachment[] | undefined;

      // Clean up stored attachment metadata
      attachmentIds?.forEach((id) => uploadedAttachmentsRef.current.delete(id));

      // Add placeholder assistant message to show loading dots immediately
      const placeholderAssistantId = `assistant-pending-${Date.now()}`;
      const placeholderAssistant: InternalMessage = {
        id: placeholderAssistantId,
        textContent: "",
        participant: assistantParticipant(sessionRef.current),
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      if (isClarificationResponse) {
        // Clarification responses are tool observations, not user messages —
        // skip the user message bubble and only show the assistant placeholder
        setMessages((prev) => [...prev, placeholderAssistant]);
      } else {
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

        setMessages((prev) => [...prev, userMessage, placeholderAssistant]);
      }
      setIsStreaming(true);
      setStreamingMessageId(placeholderAssistantId);
      setError(null);

      // This turn's handle. stopStreaming() aborts it and drops the ref, and a
      // later send installs its own, so the ref is how this turn tells whether
      // the streaming state is still its to clear.
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Whether the server answered at all. A transport failure after this
      // point means it received the message; before it, nobody can tell.
      let responseStarted = false;
      try {
        // The composer is interactive before init resolves, and stays so
        // after a failed one: wait for (or retry) the session, and let a
        // failure answer in the transcript like any other failed turn.
        let currentSession = sessionRef.current;
        if (!currentSession) {
          // Until the session arrives nothing has been sent, so a stop
          // removes this turn outright (stopStreaming reads this).
          unsentTurnRef.current = [optimisticId, placeholderAssistantId];
          try {
            currentSession = (await ensureSessionRef.current?.()) ?? null;
          } finally {
            if (unsentTurnRef.current?.[0] === optimisticId) unsentTurnRef.current = null;
          }
          if (abortController.signal.aborted) return;
          if (!currentSession) {
            throw initFailureRef.current ?? new Error("Failed to initialize");
          }
          const resolvedSession = currentSession;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderAssistantId
                ? { ...msg, participant: assistantParticipant(resolvedSession) }
                : msg
            )
          );
        }

        if (!isClarificationResponse) {
          // Notify consumer that a user message was created (for widget event
          // emission) once it is actually going out.
          configRef.current.onUserMessageCreated?.({ id: optimisticId, content });
        }

        const backendBaseUrl = getBackendBaseUrl(configRef.current);

        const response = await fetchOrNetworkError(
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
              metadata: extraMetadata || {},
              attachment_ids: attachmentIds || [],
            }),
            signal: abortController.signal,
          }
        );

        responseStarted = true;
        if (!response.ok) {
          throw new HttpError(`HTTP error: ${response.status}`, response.status);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const result = await parseSSEStream(
          reader,
          // The placeholder IS the assistant message for this turn: every
          // frame writes into it, and it keeps its id through completion.
          { optimisticId, assistantMsgId: placeholderAssistantId },
          {
            onMessageUpdate: (update) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === update.id ? { ...msg, ...update } : msg
                )
              );
            },
            onUserMessagePersisted: (optimisticUserId, serverId) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === optimisticUserId ? { ...msg, serverId } : msg
                )
              );
            },
            onStatusUpdate: (text) => {
              setStatusText(text);
              // On the message as well, so `<Message>` can show the line in
              // its waiting state without the host threading it through.
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === placeholderAssistantId
                    ? { ...msg, statusText: text ?? undefined }
                    : msg
                )
              );
            },
            onComplete: ({
              assistantMsgId,
              finalContent,
              finalId,
              chunks,
              suggestedActions,
              sources,
              visualizations,
              artifacts,
              pendingClarification,
              executionTime,
              pendingToolApproval,
              metadata,
            }) => {
              if (assistantMsgId) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          // `id` is what React keys on and never changes.
                          serverId: finalId ?? msg.serverId,
                          statusText: undefined,
                          textContent: finalContent,
                          isStreaming: false,
                          reasoning: chunks,
                          suggestedActions,
                          citations: sources,
                          // Empty means the server kept none — assign either
                          // way so a pruned draft cannot survive from the
                          // streaming update via the spread above.
                          visualizations: visualizations?.length
                            ? visualizations
                            : undefined,
                          artifacts: artifacts?.length ? artifacts : undefined,
                          pendingClarification,
                          pendingToolApproval,
                          executionTime,
                          // Kept whole: `Message` reads `turn_outcome` from
                          // here, and an allow-list is how the last four
                          // server-side additions got lost on this path.
                          metadata: metadata ?? msg.metadata,
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

        // Ensure streaming is marked complete. A turn that ended without one
        // frame touching the message has nothing to show; drop the placeholder
        // rather than leave it waiting forever.
        if (result.assistantMsgId) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === result.assistantMsgId
                ? { ...msg, isStreaming: false, statusText: undefined }
                : msg
            )
          );
        } else {
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== placeholderAssistantId)
          );
        }
      } catch (err) {
        // AbortError means user stopped streaming — keep partial content, no error
        if (err instanceof DOMException && err.name === "AbortError") {
          // Streaming was stopped by user — partial content already finalized by stopStreaming
          return;
        }

        console.error("[Miiflow] Send error:", err);

        const sess = sessionRef.current;
        const failure = describeSendFailure(err, responseStarted, assistantDisplayName(sess));
        const errorMsg = assistantErrorMessage(sess, failure.transcript);
        // The failed turn's message is the placeholder itself (one id for the
        // message's whole life). Keep it, finalized, if anything had already
        // streamed into it — partial work is still work — and drop it if it
        // was still empty; the error bubble follows either way.
        setMessages((prev) => {
          const failed = prev.find((m) => m.id === placeholderAssistantId);
          const hasContent =
            !!failed &&
            (!!failed.textContent || (failed.reasoning?.length ?? 0) > 0 || !!failed.metadata?.transcript);
          const kept = hasContent
            ? prev.map((m) =>
                m.id === placeholderAssistantId
                  ? { ...m, isStreaming: false, statusText: undefined,
                      metadata: m.metadata?.transcript ? { ...m.metadata, transcript: { ...(m.metadata.transcript as AgentTranscript), status: "failed" } } : m.metadata }
                  : m
              )
            : prev.filter((m) => m.id !== placeholderAssistantId);
          return [...kept, errorMsg];
        });
        setError(failure.error);
      } finally {
        // Stopped, and possibly superseded by a newer send: the streaming
        // state now belongs to someone else, so leave it alone.
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
          setIsStreaming(false);
          setStreamingMessageId(null);
          setStatusText(null);
        }
      }
    },
    [handleToolInvocation] // stable — reads only refs
  );

  // Stop streaming — aborts fetch, finalizes partial content
  const stopStreaming = useCallback(() => {
    if (!isStreamingRef.current) return;

    // Abort the fetch connection
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // A turn still waiting for its session was never sent: drop it now rather
    // than leave its bubbles up until that wait ends, which on a dead network
    // is a whole fetch timeout. Anything else is finalized with what it has.
    const unsent = unsentTurnRef.current;
    unsentTurnRef.current = null;
    setMessages((prev) =>
      unsent
        ? prev.filter((msg) => !unsent.includes(msg.id))
        : prev.map((msg) =>
            msg.isStreaming ? { ...msg, isStreaming: false } : msg
          )
    );

    // Reset streaming state
    isStreamingRef.current = false;
    setIsStreaming(false);
    setStreamingMessageId(null);
    setStatusText(null);
  }, []);

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

  const updateMediaToken = useCallback((token: string) => {
    // A token refreshed for a thread the session has since left is dropped.
    setSession((current) =>
      current ? (sessionWithRefreshedToken(current, token) ?? current) : current
    );
  }, []);
  const mediaResources = useMediaDelivery(
    messages.flatMap((message) => message.medias || []),
    getBackendBaseUrl(config), session?.token, config.publicKey,
    session?.session_id || "", updateMediaToken,
  );

  // Convert internal messages to ChatMessage format.
  // Hidden page-context messages (role=system) are never rendered — they exist
  // only in history for the LLM's benefit.
  const chatMessages: ChatMessage[] = useMemo(
    () =>
      withReferencedMedia(messages
        .filter((msg) => msg.participant.role !== "system")
        .map((msg) => ({
          id: msg.id,
          serverId: msg.serverId,
          textContent: msg.textContent ? stripCitationMarkers(msg.textContent) : msg.textContent,
          participant: msg.participant,
          createdAt: msg.createdAt,
          isStreaming: msg.isStreaming,
          statusText: msg.statusText,
          reasoning: msg.reasoning,
          suggestedActions: msg.suggestedActions,
          citations: msg.citations,
          attachments: msg.attachments,
          pendingClarification: msg.pendingClarification,
          pendingToolApproval: msg.pendingToolApproval,
          // `Message` reads these off the message when the props are omitted
          // (0.16.0); they were collected but never mapped, so that fallback
          // never reached a `useMiiflowChat` consumer.
          visualizations: msg.visualizations,
          medias: msg.medias?.map((media) => deliveredMedia(media, mediaResources)),
          artifacts: msg.artifacts,
          executionTime: msg.executionTime,
        }))),
    [messages, mediaResources]
  );

  // Allow external session updates (e.g. token refresh from widget class)
  const updateSession = useCallback((newSession: EmbedSession) => {
    setSession(newSession);
  }, []);

  return {
    messages: chatMessages,
    isStreaming,
    streamingMessageId,
    statusText,
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
    sendPageContext,
    handleToolInvocation,
    updateSession,
    stopStreaming,
  };
}
