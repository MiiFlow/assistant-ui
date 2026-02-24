/**
 * useMiiflowChat - React hook for connecting to Miiflow's embedded chat API.
 *
 * Handles session init, SSE streaming, message management, tool registration,
 * and branding. Returns a shape directly compatible with ChatProvider props.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { ChatMessage, ParticipantRole, StreamingChunk, ClarificationData } from "../types";
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
}

type ChunkType =
  | "answer"
  | "thinking"
  | "tool"
  | "observation"
  | "planning"
  | "subtask"
  | "progress"
  | "clarification_needed";

interface AccumulatedChunk {
  type: string;
  content: string;
  toolName?: string;
  toolDescription?: string;
  status?: string;
  success?: boolean;
  subtaskId?: number;
  clarificationData?: ClarificationData;
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
    pendingClarification?: ClarificationData
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
      });
      currentChunkContent = "";
      currentToolName = undefined;
      currentToolDescription = undefined;
      currentSuccess = undefined;
      currentToolStatus = undefined;
      currentSubtaskId = undefined;
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

          // Determine chunk type
          let newChunkType: ChunkType = "answer";
          if (parsed.is_thinking) {
            newChunkType = "thinking";
          } else if (
            parsed.is_planning ||
            parsed.is_plan_complete ||
            parsed.is_replanning ||
            parsed.is_synthesis_start
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

          callbacks.onComplete(
            assistantMsgId,
            finalContent,
            finalId,
            chunks as unknown as StreamingChunk[],
            suggestedActions,
            sources,
            pendingClarification
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
            callbacks.onComplete(
              assistantMsgId,
              assistantContent || "",
              parsed.message_id,
              chunks as unknown as StreamingChunk[],
              suggestedActions,
              undefined,
              pendingClarification
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

        await sendToolResult(configRef.current, currentSession, {
          invocation_id,
          result,
        });
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
            handleToolInvocation(data.invocation).then((handled) => {
              if (!handled) {
                const fallback = configRef.current.onToolInvocationFallback;
                if (fallback) {
                  fallback(data.invocation).catch(console.error);
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
              pendingClarification
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
        textContent: msg.textContent?.replace(/\[ref:[\w]+\]/g, '') || msg.textContent,
        participant: msg.participant,
        createdAt: msg.createdAt,
        isStreaming: msg.isStreaming,
        reasoning: msg.reasoning,
        suggestedActions: msg.suggestedActions,
        citations: msg.citations,
        attachments: msg.attachments,
        pendingClarification: msg.pendingClarification,
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
