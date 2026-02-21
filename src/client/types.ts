/**
 * Types for the Miiflow chat client (transport layer).
 */

import type { ChatMessage } from "../types/message";
import type { BrandingData } from "../types/branding";

// ============================================================================
// Configuration
// ============================================================================

export interface MiiflowChatConfig {
  /** Public API key for authentication */
  publicKey: string;
  /** Assistant ID to connect to */
  assistantId: string;
  /** Optional user ID for identity */
  userId?: string;
  /** Optional user display name */
  userName?: string;
  /** Optional user email */
  userEmail?: string;
  /** Optional user metadata (JSON string) */
  userMetadata?: string;
  /** HMAC for identity verification */
  hmac?: string;
  /** Timestamp for HMAC verification */
  timestamp?: string;
  /** Override base URL (auto-detected from bundleUrl otherwise) */
  baseUrl?: string;
  /** Bundle URL used for dev detection (internal, set by script embed) */
  bundleUrl?: string;
  /** Response timeout in milliseconds (default: 60000) */
  responseTimeout?: number;
  /** WebSocket URL for bidirectional events (tool invocations). Auto-derived from baseUrl if not set. */
  webSocketUrl?: string;
  /** Fallback for tool invocations not handled locally (multi-widget routing) */
  onToolInvocationFallback?: (invocation: ToolInvocationRequest) => Promise<boolean>;
  /** Callback fired when a user message is created (for widget event emission) */
  onUserMessageCreated?: (message: { id: string; content: string }) => void;
  /** Callback fired when an assistant message stream completes (for widget event emission) */
  onAssistantMessageComplete?: (message: { id: string; content: string }) => void;
}

// ============================================================================
// Session
// ============================================================================

export interface EmbedSessionBranding {
  show_header?: boolean;
  custom_name?: string;
  welcome_message?: string;
  chatbox_placeholder?: string;
  background_bubble_color?: string;
  header_background_color?: string;
  message_font_size?: number;
  rotating_placeholders?: string[];
  preset_questions?: string[];
  assistant_avatar?: string;
  chatbot_logo?: string;
}

export interface EmbedSessionConfig {
  assistant_id: string;
  assistant_name: string;
  assistant_description: string;
  thread_id: string;
  branding?: EmbedSessionBranding;
}

export interface EmbedSession {
  token: string;
  config: EmbedSessionConfig;
  session_id: string;
}

// ============================================================================
// Hook return type
// ============================================================================

export interface MiiflowChatResult {
  /** Chat messages in ChatMessage format (directly compatible with ChatProvider) */
  messages: ChatMessage[];
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** ID of the message being streamed */
  streamingMessageId: string | null;
  /** Send a message to the assistant, optionally with attachment IDs */
  sendMessage: (content: string, attachmentIds?: string[]) => Promise<void>;
  /** Upload a file and return its attachment ID */
  uploadFile: (file: File) => Promise<string>;
  /** Remove uploaded attachment metadata (call when user removes attachment before sending) */
  removeUploadedAttachment: (attachmentId: string) => void;

  /** Current session data */
  session: EmbedSession | null;
  /** Whether the session is still initializing */
  loading: boolean;
  /** Error message if initialization or sending failed */
  error: string | null;

  /** Branding data from the session, mapped to BrandingData */
  branding: BrandingData | null;
  /** CSS custom properties derived from branding (spread onto container) */
  brandingCSSVars: React.CSSProperties;

  /** Start a new thread, returns the new thread ID */
  startNewThread: () => Promise<string>;

  /** Register a client-side tool */
  registerTool: (tool: ClientToolDefinition) => Promise<void>;
  /** Register multiple client-side tools */
  registerTools: (tools: ClientToolDefinition[]) => Promise<void>;

  /** Send a system event (invisible to chat, processed by assistant) */
  sendSystemEvent: (event: SystemEvent) => Promise<void>;
  /** Execute a client tool invocation (called when backend invokes a registered tool). Returns true if handled. */
  handleToolInvocation: (invocation: ToolInvocationRequest) => Promise<boolean>;
  /** Update the session externally (e.g. after token refresh) */
  updateSession: (session: EmbedSession) => void;
}

// ============================================================================
// Tool Registration
// ============================================================================

export interface JSONSchemaProperty {
  type:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "array"
    | "object"
    | "null";
  description?: string;
  enum?: Array<string | number | boolean>;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: unknown;
}

export interface JSONSchemaObject {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaProperty;
  description?: string;
}

export type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

export interface ClientToolDefinition {
  /** Tool name (alphanumeric + underscore, must start with letter/underscore) */
  name: string;
  /** Description of what the tool does (shown to LLM) */
  description: string;
  /** JSON Schema defining the tool's parameters */
  parameters: JSONSchemaObject;
  /** Handler function to execute when LLM calls this tool */
  handler: ToolHandler;
}

export interface ToolInvocationRequest {
  invocation_id: string;
  tool_name: string;
  parameters: Record<string, unknown>;
}

export interface ToolExecutionResult {
  invocation_id: string;
  result?: unknown;
  error?: string;
}

// ============================================================================
// System Events
// ============================================================================

export interface SystemEvent {
  action: string;
  description: string;
  followUpInstruction: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Widget Events
// ============================================================================

export type WidgetEventType =
  | "widget_ready"
  | "widget_opened"
  | "widget_closed"
  | "widget_reconnected"
  | "session_start"
  | "session_end"
  | "thread_started"
  | "new_message"
  | "message_sent"
  | "message_received"
  | "error"
  | "load_failed"
  | "assistant_response_timeout";

export type WidgetEventPayload = Record<string, unknown> | undefined;

export type WidgetEventCallback = (
  type: WidgetEventType,
  payload?: WidgetEventPayload
) => void;
