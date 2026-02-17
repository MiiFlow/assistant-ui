// Styled components - TailwindCSS defaults
export { AttachmentPreview, type AttachmentPreviewProps } from "./AttachmentPreview";
export { Avatar, type AvatarProps } from "./Avatar";
export { ChatContainer, type ChatContainerProps } from "./ChatContainer";
export { LoadingDots, type LoadingDotsProps } from "./LoadingDots";
export { MarkdownContent, type MarkdownContentProps } from "./MarkdownContent";
export { Message, useMessage, type MessageProps } from "./Message";
export { MessageComposer, useComposer, type MessageComposerProps } from "./MessageComposer";
export { MessageList, type MessageListProps } from "./MessageList";
export { StreamingText, type StreamingTextProps } from "./StreamingText";
export { SuggestedActions, type SuggestedActionsProps } from "./SuggestedActions";
export { TimeMarker, type TimeMarkerProps } from "./TimeMarker";
export { TypingIndicator, type TypingIndicatorProps } from "./TypingIndicator";

// New components for main app integration
export { ChatHeader, type ChatHeaderAction, type ChatHeaderProps } from "./ChatHeader";
export { MessageAttachments, type MessageAttachmentsProps } from "./MessageAttachments";
export { ReasoningPanel, type ReasoningPanelProps } from "./ReasoningPanel";

// Layout components
export { ChatLayout, type ChatLayoutProps } from "./ChatLayout";
export { WelcomeScreen, type WelcomeScreenProps } from "./WelcomeScreen";

// Clarification panel
export { ClarificationPanel, type ClarificationPanelProps } from "./ClarificationPanel";

// Citation sources
export { CitationSources, type CitationSourcesProps, InlineCitation, type InlineCitationProps, SourceDetailModal, type SourceDetailModalProps } from "./CitationSources";

// Claude SDK components
export {
  ClaudeToolPreview,
  type ClaudeToolPreviewProps,
  TerminalOutput,
  type TerminalOutputProps,
  FileOperationPreview,
  type FileOperationPreviewProps,
  SearchResultsView,
  type SearchResultsViewProps,
  WebOperationPreview,
  type WebOperationPreviewProps,
  SubagentPanel,
  type SubagentPanelProps,
} from "./claude-sdk";

// Visualization components
export {
  VisualizationRenderer,
  type VisualizationRendererProps,
  ChartVisualization,
  type ChartVisualizationProps,
  TableVisualization,
  type TableVisualizationProps,
  CardVisualization,
  type CardVisualizationProps,
  KpiVisualization,
  type KpiVisualizationProps,
  CodePreviewVisualization,
  type CodePreviewVisualizationProps,
  FormVisualization,
  type FormVisualizationProps,
} from "./visualizations";

// Timeline components
export { EventContent } from "./EventContent";
export { convertChunkToEvent, convertTimelineToEvents, EventTimeline, type EventTimelineProps } from "./EventTimeline";
export { PlanTimeline, type PlanTimelineProps } from "./PlanTimeline";
export { StatusBadge } from "./StatusBadge";
export { Timeline, TimelineItem, type TimelineItemData, type TimelineItemProps, type TimelineProps } from "./Timeline";

// Re-export context for convenience
export { ChatProvider, useChatContext, type ChatContextValue, type ChatProviderProps } from "../context";

// Re-export types for convenience
export type { Attachment, BrandingData, ChatMessage, MessageData, Participant, ParticipantRole, SuggestedAction, SuggestedActionType } from "../types";

// Re-export advanced streaming types
export type {
	ChunkType,
	Event,
	// Event timeline types
	EventStatus,
	EventType,
	FollowupAction,
	ObservationEvent,
	PlanData,
	PlanningEvent,
	ProgressData,
	StreamingChunk,
	StreamingMessage,
	SubTaskData,
	SubtaskEvent,
	ThinkingEvent,
	ToolEvent,
	// Parallel execution types
	WaveData,
	ParallelSubtaskData,
	// Multi-agent types
	SubagentInfo,
	// Claude SDK chunk types
	SubagentChunkData,
	FileOperationChunkData,
	TerminalChunkData,
	SearchResultsChunkData,
	WebOperationChunkData,
	ClaudeToolChunkData,
	ClarificationData,
	// Visualization types
	VisualizationType,
	VisualizationChunkData,
	VisualizationConfig,
	// Citation types
	SourceReference,
	SourceTypeConfig,
} from "../types";
