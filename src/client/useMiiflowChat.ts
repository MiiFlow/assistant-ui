/**
 * useMiiflowChat - React hook for connecting to Miiflow's embedded chat API.
 *
 * Handles session init, SSE streaming, message management, tool registration,
 * and branding. Returns a shape directly compatible with ChatProvider props.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { ChatMessage, ParticipantRole, StreamingChunk } from "../types";
import type { BrandingData } from "../types/branding";
import type {
  MiiflowChatConfig,
  MiiflowChatResult,
  EmbedSession,
  ClientToolDefinition,
  ToolHandler,
} from "./types";
import {
  initSession,
  getBackendBaseUrl,
  getOrCreateUserId,
  createThread,
  registerToolsOnBackend,
} from "./session";
import { validateToolDefinition, serializeToolDefinition } from "./tool-validator";
import { useBrandingCSSVars } from "../hooks/use-branding-css-vars";

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
}

type ChunkType =
  | "answer"
  | "thinking"
  | "tool"
  | "observation"
  | "planning"
  | "subtask"
  | "progress";

interface AccumulatedChunk {
  type: string;
  content: string;
  toolName?: string;
  toolDescription?: string;
  status?: string;
  success?: boolean;
  subtaskId?: number;
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
    suggestedActions?: Array<{ id: string; label: string; value: string }>
  ) => void;
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
        } else if (parsed.type === "assistant_complete") {
          finalizeChunk();

          const finalContent =
            parsed.message?.text_content || assistantContent;
          const finalId = parsed.message?.id;

          callbacks.onComplete(
            assistantMsgId,
            finalContent,
            finalId,
            chunks as unknown as StreamingChunk[],
            suggestedActions
          );
          assistantContent = finalContent;
          if (finalId) assistantMsgId = finalId;
          break;
        } else if (parsed.type === "error") {
          throw new Error(parsed.error || "Stream error");
        } else if (parsed.type === "done") {
          if (parsed.message_id && assistantMsgId) {
            callbacks.onMessageUpdate({
              id: assistantMsgId,
              isStreaming: false,
            });
            if (parsed.message_id) assistantMsgId = parsed.message_id;
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

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming || !session) return;

      const optimisticId = `msg-${Date.now()}`;

      const userMessage: InternalMessage = {
        id: optimisticId,
        textContent: content,
        participant: {
          id: "user",
          name: configRef.current.userName || "You",
          role: "user",
        },
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      try {
        const backendBaseUrl = getBackendBaseUrl(configRef.current);
        const hostBaseUrl = backendBaseUrl.replace(/\/api$/, "");

        const response = await fetch(
          `${hostBaseUrl}/assistant/message/stream/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.token}`,
              "x-mii-user-id": getOrCreateUserId(),
            },
            body: JSON.stringify({
              thread_id: session.config.thread_id,
              text_content: content,
              message_id: optimisticId,
              metadata: {},
              attachment_ids: [],
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
          session,
          optimisticId,
          {
            onMessageCreate: (msg) => {
              setStreamingMessageId(msg.id);
              setMessages((prev) => [...prev, msg]);
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
              suggestedActions
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
                        }
                      : msg
                  )
                );
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

        const errorMsg: InternalMessage = {
          id: `error-${Date.now()}`,
          textContent: "Sorry, I encountered an error. Please try again.",
          participant: {
            id: "assistant",
            name:
              session.config.branding?.custom_name ||
              session.config.assistant_name,
            role: "assistant",
            avatarUrl: session.config.branding?.assistant_avatar,
          },
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setError(err instanceof Error ? err.message : "Send failed");
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    },
    [isStreaming, session]
  );

  // Start new thread
  const startNewThread = useCallback(async (): Promise<string> => {
    if (!session) throw new Error("Not initialized");

    const result = await createThread(configRef.current, session);
    const updatedSession: EmbedSession = {
      ...session,
      config: { ...session.config, thread_id: result.threadId },
      token: result.token || session.token,
    };
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
  }, [session]);

  // Register tool
  const registerTool = useCallback(
    async (tool: ClientToolDefinition): Promise<void> => {
      if (!session) throw new Error("Not initialized");

      validateToolDefinition(tool);

      toolHandlersRef.current.set(tool.name, tool.handler);
      const serialized = serializeToolDefinition(tool);
      toolDefinitionsRef.current.set(tool.name, serialized);

      try {
        await registerToolsOnBackend(configRef.current, session, [serialized]);
      } catch (err) {
        toolHandlersRef.current.delete(tool.name);
        toolDefinitionsRef.current.delete(tool.name);
        throw err;
      }
    },
    [session]
  );

  // Register multiple tools
  const registerTools = useCallback(
    async (tools: ClientToolDefinition[]): Promise<void> => {
      for (const tool of tools) {
        await registerTool(tool);
      }
    },
    [registerTool]
  );

  // Convert internal messages to ChatMessage format
  const chatMessages: ChatMessage[] = useMemo(
    () =>
      messages.map((msg) => ({
        id: msg.id,
        textContent: msg.textContent,
        participant: msg.participant,
        createdAt: msg.createdAt,
        isStreaming: msg.isStreaming,
        reasoning: msg.reasoning,
        suggestedActions: msg.suggestedActions,
      })),
    [messages]
  );

  return {
    messages: chatMessages,
    isStreaming,
    streamingMessageId,
    sendMessage,
    session,
    loading,
    error,
    branding,
    brandingCSSVars,
    startNewThread,
    registerTool,
    registerTools,
  };
}
