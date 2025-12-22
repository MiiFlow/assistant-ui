// @miiflow/chat-ui - Headless chat UI primitives with TailwindCSS styling

// Types
export type {
  ParticipantRole,
  Participant,
  Attachment,
  MessageData,
  SuggestedAction,
  ChatMessage,
  ReasoningChunk,
  StreamingState,
  StreamChunk,
  StreamingOptions,
} from "./types";

// Context & Provider
export {
  ChatProvider,
  ChatContext,
  useChatContext,
  type ChatProviderProps,
  type ChatContextValue,
} from "./context";

// Hooks
export {
  useAutoScroll,
  useStreaming,
  useMessageComposer,
  useAttachments,
} from "./hooks";

// Primitives (headless, unstyled)
export {
  // Message primitives
  Message as MessagePrimitive,
  MessageContent as MessageContentPrimitive,
  MessageTimestamp as MessageTimestampPrimitive,
  MessageContext,
  useMessage,
  // Message list
  MessageList as MessageListPrimitive,
  // Composer primitives
  MessageComposer as MessageComposerPrimitive,
  ComposerInput,
  ComposerSubmit,
  ComposerContext,
  useComposer,
  // Avatar
  Avatar as AvatarPrimitive,
  // Streaming
  StreamingText as StreamingTextPrimitive,
  // Suggested actions
  SuggestedActions as SuggestedActionsPrimitive,
  ActionButton,
  SuggestedActionsContext,
  useSuggestedActions,
  // Typing indicator
  TypingIndicator as TypingIndicatorPrimitive,
} from "./primitives";

// Styled components (TailwindCSS defaults)
export {
  ChatContainer,
  MessageList,
  Message,
  MessageComposer,
  Avatar,
  TypingIndicator,
  SuggestedActions,
  StreamingText,
  MarkdownContent,
  AttachmentPreview,
} from "./styled";

// Utilities
export { cn } from "./utils/cn";
export { formatMessageTime, formatRelativeTime } from "./utils/format-date";

// Design tokens
export { chatTokens, type ChatTokens } from "./styles/tokens";
