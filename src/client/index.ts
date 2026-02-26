// @miiflow/assistant-ui/client - Transport layer for Miiflow embedded chat

// Main hook
export { useMiiflowChat } from "./useMiiflowChat";

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
  sendToolResult,
} from "./session";

// Token utilities
export {
  parseTokenExpiry,
  isTokenExpiringSoon,
  isTokenExpired,
  getTimeUntilExpiry,
} from "./token-utils";

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
  WidgetEventType,
  WidgetEventPayload,
  WidgetEventCallback,
} from "./types";
