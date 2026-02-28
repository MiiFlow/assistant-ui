// @miiflow/assistant-ui - Headless chat UI primitives with TailwindCSS styling

// Types
export type {
  ParticipantRole,
  Participant,
  Attachment,
  MessageData,
  MessageError,
  SuggestedAction,
  SuggestedActionType,
  ChatMessage,
  ReasoningChunk,
  StreamingState,
  StreamChunk,
  StreamingOptions,
  BrandingData,
  SourceReference,
  SourceTypeConfig,
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
  useScrollLock,
  useStreaming,
  useMessageComposer,
  useAttachments,
  useBrandingCSSVars,
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
  ChatLayout,
  MessageList,
  Message,
  MessageActionBar,
  MessageComposer,
  Avatar,
  TypingIndicator,
  SuggestedActions,
  StreamingText,
  MarkdownContent,
  AttachmentPreview,
  WelcomeScreen,
  ScrollToBottomButton,
  ToolStatusIndicator,
} from "./styled";

// Utilities
export { cn } from "./utils/cn";
export { formatMessageTime, formatRelativeTime } from "./utils/format-date";
export { getContrastTextColor } from "./utils/color-contrast";

// Design tokens
export { chatTokens, type ChatTokens } from "./styles/tokens";
