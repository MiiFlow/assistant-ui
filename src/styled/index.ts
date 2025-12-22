// Styled components - TailwindCSS defaults
export { ChatContainer, type ChatContainerProps } from "./ChatContainer";
export { MessageList, type MessageListProps } from "./MessageList";
export { Message, useMessage, type MessageProps } from "./Message";
export { MessageComposer, useComposer, type MessageComposerProps } from "./MessageComposer";
export { Avatar, type AvatarProps } from "./Avatar";
export { TypingIndicator, type TypingIndicatorProps } from "./TypingIndicator";
export { SuggestedActions, type SuggestedActionsProps } from "./SuggestedActions";
export { StreamingText, type StreamingTextProps } from "./StreamingText";
export { MarkdownContent, type MarkdownContentProps } from "./MarkdownContent";
export { AttachmentPreview, type AttachmentPreviewProps } from "./AttachmentPreview";
export { LoadingDots, type LoadingDotsProps } from "./LoadingDots";

// New components for main app integration
export { ChatHeader, type ChatHeaderProps, type ChatHeaderAction } from "./ChatHeader";
export { ReasoningPanel, type ReasoningPanelProps } from "./ReasoningPanel";
export { MessageAttachments, type MessageAttachmentsProps } from "./MessageAttachments";

// Timeline components
export { StatusBadge } from "./StatusBadge";
export { Timeline, TimelineItem, type TimelineItemData, type TimelineProps, type TimelineItemProps } from "./Timeline";
export { EventTimeline, convertChunkToEvent, convertTimelineToEvents, type EventTimelineProps } from "./EventTimeline";
export { EventContent } from "./EventContent";
export { PlanTimeline, type PlanTimelineProps } from "./PlanTimeline";

// Re-export context for convenience
export { ChatProvider, useChatContext, type ChatProviderProps, type ChatContextValue } from "../context";

// Re-export types for convenience
export type {
  ChatMessage,
  MessageData,
  ParticipantRole,
  Participant,
  Attachment,
  SuggestedAction,
} from "../types";

// Re-export advanced streaming types
export type {
  ChunkType,
  StreamingChunk,
  StreamingMessage,
  PlanData,
  SubTaskData,
  ProgressData,
  FollowupAction,
  // Event timeline types
  EventStatus,
  EventType,
  Event,
  ThinkingEvent,
  PlanningEvent,
  ToolEvent,
  ObservationEvent,
  SubtaskEvent,
} from "../types";
