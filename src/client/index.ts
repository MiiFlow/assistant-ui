// @miiflow/assistant-ui/client - Transport layer for Miiflow embedded chat

// Main hook
export { useMiiflowChat, HANDLED_STREAM_EVENT_TYPES } from "./useMiiflowChat";

// Session utilities
export {
  initSession,
  createThread,
  updateUser,
  getBackendBaseUrl,
  getOrCreateUserId,
  registerToolsOnBackend,
  uploadFile,
  sendSystemEvent,
  sendPageContext,
  sendToolResult,
} from "./session";

// Token utilities
export {
  parseTokenExpiry,
  isTokenExpiringSoon,
  isTokenExpired,
  getTimeUntilExpiry,
} from "./token-utils";

// Off-DOM text measurement
export {
  measureMessageHeight,
  clearMeasurementCache,
} from "../utils/measureMessage";
export type {
  MeasureOptions,
  MeasuredText,
} from "../utils/measureMessage";

// Tool-frame → chunk correlation (shared with the web dashboard's reducers)
export { findToolChunkIndex } from "./tool-chunk-matching";
export type { MatchableToolChunk, ToolFrame } from "./tool-chunk-matching";

// Tool validation
export {
  validateToolDefinition,
  serializeToolDefinition,
  ToolValidationError,
} from "./tool-validator";

// Types
export type {
  MiiflowChatConfig,
  MiiflowChatResult,
  EmbedSession,
  EmbedSessionBranding,
  EmbedSessionConfig,
  ClientToolDefinition,
  JSONSchemaProperty,
  JSONSchemaObject,
  ToolHandler,
  ToolInvocationRequest,
  ToolExecutionResult,
  SystemEvent,
  PageContext,
  WidgetEventType,
  WidgetEventPayload,
  WidgetEventCallback,
} from "./types";
