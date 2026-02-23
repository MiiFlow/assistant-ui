import { forwardRef, useContext, useMemo, useRef } from "react";
import { MessageContent as MessageContentPrimitive, Message as MessagePrimitive } from "../primitives";
import type {
	ClarificationData,
	MessageData,
	ParticipantRole,
	SourceReference,
	StreamingChunk,
	SuggestedAction,
	VisualizationChunkData,
} from "../types";
import { cn } from "../utils/cn";
import { ChatContext } from "../context/ChatProvider";
import { Avatar } from "./Avatar";
import { CitationSources } from "./CitationSources";
import { ClarificationPanel } from "./ClarificationPanel";
import { LoadingDots } from "./LoadingDots";
import { MarkdownContent } from "./MarkdownContent";
import { MessageAttachments } from "./MessageAttachments";
import { ReasoningPanel } from "./ReasoningPanel";
import { StreamingText } from "./StreamingText";
import { SuggestedActions } from "./SuggestedActions";
import { VisualizationRenderer } from "./visualizations";

// Regex to match visualization markers [VIZ:uuid]
const VIZ_MARKER_REGEX = /\[VIZ:([a-f0-9-]+)\]/gi;

/**
 * Parse content and split it by visualization markers.
 * Returns an array of alternating text and visualization IDs.
 */
function parseContentWithVisualizations(
	content: string,
): Array<{ type: "text"; content: string } | { type: "viz"; id: string }> {
	const parts: Array<{ type: "text"; content: string } | { type: "viz"; id: string }> = [];
	let lastIndex = 0;
	let match;

	// Reset regex lastIndex
	VIZ_MARKER_REGEX.lastIndex = 0;

	while ((match = VIZ_MARKER_REGEX.exec(content)) !== null) {
		if (match.index > lastIndex) {
			const text = content.slice(lastIndex, match.index);
			if (text.trim()) {
				parts.push({ type: "text", content: text });
			}
		}
		parts.push({ type: "viz", id: match[1] });
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < content.length) {
		const text = content.slice(lastIndex);
		if (text.trim()) {
			parts.push({ type: "text", content: text });
		}
	}

	return parts;
}

export interface MessageProps {
	/** The message data */
	message: MessageData;
	/** The viewer's role (determines alignment) */
	viewerRole?: ParticipantRole;
	/** Additional CSS classes */
	className?: string;
	/** Whether to show avatar */
	showAvatar?: boolean;
	/** Whether to show timestamp */
	showTimestamp?: boolean;
	/** Whether to render content as markdown */
	renderMarkdown?: boolean;
	/** Streaming chunks for reasoning panel */
	reasoning?: StreamingChunk[];
	/** Execution plan for completed Plan & Execute messages */
	executionPlan?: unknown;
	/** Execution timeline for completed messages (all orchestrator modes) */
	executionTimeline?: unknown[];
	/** Suggested actions */
	suggestedActions?: SuggestedAction[];
	/** Callback when suggested action is selected */
	onSuggestedAction?: (action: SuggestedAction) => void;
	/** Whether reasoning panel is expanded */
	reasoningExpanded?: boolean;
	/** Callback when reasoning panel expansion changes */
	onReasoningExpandedChange?: (expanded: boolean) => void;
	/** Citation sources to display after message content */
	citations?: SourceReference[];
	/** Inline visualizations to render within message content */
	visualizations?: VisualizationChunkData[];
	/** Base font size multiplier for markdown rendering */
	baselineFontSize?: number;
	/** Pending clarification data (agent needs user input) */
	pendingClarification?: ClarificationData;
	/** Callback when user responds to a clarification */
	onClarificationSubmit?: (response: string) => void;
}

/**
 * Styled Message component with grid layout matching the main app.
 * Uses grid to align avatar and content, with reasoning above content.
 * Supports attachments, citations, inline visualizations, and streaming text.
 */
export const Message = forwardRef<HTMLDivElement, MessageProps>(
	(
		{
			message,
			viewerRole = "user",
			className,
			showAvatar = true,
			showTimestamp = true,
			renderMarkdown = true,
			reasoning,
			executionPlan,
			executionTimeline,
			suggestedActions,
			onSuggestedAction,
			reasoningExpanded,
			onReasoningExpandedChange,
			citations,
			visualizations,
			baselineFontSize,
			pendingClarification,
			onClarificationSubmit,
		},
		ref,
	) => {
		// Get visualization action callback from context (null-safe for standalone usage)
		const chatContext = useContext(ChatContext);
		const onVisualizationAction = chatContext?.onVisualizationAction;

		// Case-insensitive comparison for role matching
		const participantRole = (message.participant?.role || "").toLowerCase();
		const viewerRoleLower = (viewerRole || "").toLowerCase();
		const isViewer = participantRole === viewerRoleLower;
		const isAssistant = participantRole === "assistant";
		const isStreaming = message.isStreaming;

		// Filter reasoning chunks for display
		// Includes all reasoning-related types: ReAct, Parallel Plan, Multi-Agent, Claude SDK
		const reasoningChunks = reasoning?.filter(
			(c) =>
				// Legacy ReAct types
				c.type === "thinking" ||
				c.type === "tool" ||
				c.type === "observation" ||
				c.type === "planning" ||
				c.type === "subtask" ||
				// Parallel Plan execution (wave-based)
				c.type === "wave_start" ||
				c.type === "wave_complete" ||
				c.type === "parallel_subtask_start" ||
				c.type === "parallel_subtask_complete" ||
				// Multi-Agent execution (miiflow-llm)
				c.type === "multi_agent_planning" ||
				c.type === "subagent_start" ||
				c.type === "subagent_complete" ||
				c.type === "subagent_failed" ||
				c.type === "synthesis" ||
				// Claude SDK native types
				c.type === "claude_thinking" ||
				c.type === "subagent" ||
				c.type === "file_operation" ||
				c.type === "terminal" ||
				c.type === "search_results" ||
				c.type === "web_operation" ||
				// Generic Claude tools (check for claudeToolData)
				c.claudeToolData != null,
		);
		const hasReasoningChunks = reasoningChunks && reasoningChunks.length > 0;
		const hasCompletedReasoning =
			!isStreaming && (executionPlan || (executionTimeline && executionTimeline.length > 0));
		const hasReasoning = hasReasoningChunks || hasCompletedReasoning;

		// Check if waiting for content
		const isWaitingForContent = isStreaming && !message.textContent && !hasReasoning;

		// Attachments from message data
		const attachments = message.attachments;
		const hasAttachments = attachments && attachments.length > 0;

		// Visualization map for inline rendering
		const vizMap = useMemo(() => {
			if (!visualizations || visualizations.length === 0) return null;
			const map = new Map<string, VisualizationChunkData>();
			visualizations.forEach((viz) => map.set(viz.id, viz));
			return map;
		}, [visualizations]);

		// Parse content for visualization markers
		const hasViz = vizMap && vizMap.size > 0;
		const contentParts = useMemo(() => {
			if (!hasViz || !message.textContent) return null;
			return parseContentWithVisualizations(message.textContent);
		}, [hasViz, message.textContent]);

		const renderContent = () => {
			if (!message.textContent) return null;

			// Content with inline visualizations
			if (contentParts && contentParts.length > 0 && vizMap) {
				return (
					<>
						{contentParts.map((part, idx) => {
							if (part.type === "text") {
								return isStreaming ? (
									<StreamingText key={idx} content={part.content} isStreaming baselineFontSize={baselineFontSize} />
								) : (
									<MarkdownContent
										key={idx}
										baselineFontSize={baselineFontSize}
										className={isViewer ? "prose-invert" : ""}>
										{part.content}
									</MarkdownContent>
								);
							}
							const viz = vizMap.get(part.id);
							if (viz) {
								return <VisualizationRenderer key={`viz-${part.id}`} data={viz} isStreaming={isStreaming} onAction={onVisualizationAction} />;
							}
							return null;
						})}
					</>
				);
			}

			// Streaming text with typewriter
			if (isStreaming && renderMarkdown) {
				return (
					<StreamingText
						content={message.textContent}
						isStreaming
						baselineFontSize={baselineFontSize}
						className={isViewer ? "prose-invert" : ""}
					/>
				);
			}

			// Static markdown
			if (renderMarkdown) {
				return (
					<MarkdownContent baselineFontSize={baselineFontSize} className={isViewer ? "prose-invert" : ""}>
						{message.textContent}
					</MarkdownContent>
				);
			}

			return <p className="whitespace-pre-wrap">{message.textContent}</p>;
		};

		// Track if this message was ever in streaming state.
		// Streamed messages are already visible — re-animating them on completion causes a flash.
		const wasStreamingRef = useRef(isStreaming);
		if (isStreaming) wasStreamingRef.current = true;
		const showFadeIn = !isStreaming && !wasStreamingRef.current;

		return (
			<MessagePrimitive
				ref={ref}
				message={message}
				viewerRole={viewerRole}
				className={cn("w-full", showFadeIn && "animate-fade-in", className)}>
				<div
					className={cn("flex flex-col gap-1 w-full")}
					data-is-viewer={isViewer}>
					{/* Loading indicator: avatar + dots in same row */}
					{isWaitingForContent && (
						<div className={cn("flex items-start gap-2 w-full")}>
							{showAvatar && !isViewer && (
								<div className="flex-shrink-0">
									<Avatar
										name={message.participant?.name}
										src={message.participant?.avatarUrl}
										role={message.participant?.role}
										className="w-10 h-10 flex-shrink-0"
									/>
								</div>
							)}
							<div className="px-4 py-3">
								<LoadingDots size="small" />
							</div>
						</div>
					)}

					{/* Reasoning Panel - before content for assistant */}
					{hasReasoning && isAssistant && (
						<div className="w-full max-w-[80%]">
							<ReasoningPanel
								isStreaming={isStreaming}
								chunks={reasoningChunks}
								plan={executionPlan as any}
								executionTimeline={executionTimeline as any[]}
								expanded={reasoningExpanded}
								onExpandedChange={onReasoningExpandedChange}
							/>
						</div>
					)}

					{/* Content row: avatar + message bubble */}
					{message.textContent && (
						<div className={cn(
							"flex items-start gap-2 w-full",
							isViewer ? "flex-row-reverse" : "flex-row"
						)}>
							{/* Avatar - shown for non-viewer messages */}
							{showAvatar && !isViewer && (
								<div className="flex-shrink-0">
									<Avatar
										name={message.participant?.name}
										src={message.participant?.avatarUrl}
										role={message.participant?.role}
										className="w-10 h-10 flex-shrink-0"
									/>
								</div>
							)}

							{/* Message bubble */}
							<div className={cn("max-w-[85%]", "flex flex-col")} data-message-role={isViewer ? "viewer" : "other"}>
								<div
									className={cn(
									"rounded-2xl",
									isViewer || showAvatar ? "px-4 py-3" : "",
								)}
									style={{
										backgroundColor: isViewer ? "var(--chat-user-message-bg)" : "transparent",
										color: isViewer ? "var(--chat-user-message-text, #ffffff)" : "var(--chat-text)",
									}}>
									<MessageContentPrimitive>{renderContent()}</MessageContentPrimitive>

									{/* Citations */}
									{citations && citations.length > 0 && (
										<div className="mt-2 pt-2 border-t border-[var(--chat-border)]">
											<CitationSources sources={citations} />
										</div>
									)}
								</div>

								{/* Attachments — outside bubble */}
								{hasAttachments && (
									<div className="mt-2">
										<MessageAttachments attachments={attachments} />
									</div>
								)}

								{/* Timestamp — outside bubble */}
								{showTimestamp && !isStreaming && message.createdAt && (
									<MessageTimestamp
										createdAt={
											typeof message.createdAt === "string" ? message.createdAt : message.createdAt.toISOString()
										}
										isViewer={isViewer}
									/>
								)}
							</div>
						</div>
					)}

					{/* Standalone avatar: only for reasoning, NOT loading (loading has its own avatar row above) */}
					{!message.textContent && showAvatar && !isViewer && hasReasoning && !isWaitingForContent && (
						<div className="flex items-start gap-2 w-full">
							<div className="flex-shrink-0">
								<Avatar
									name={message.participant?.name}
									src={message.participant?.avatarUrl}
									role={message.participant?.role}
									className="w-10 h-10 flex-shrink-0"
								/>
							</div>
						</div>
					)}

					{/* Clarification panel - when agent needs user input */}
					{pendingClarification && !isStreaming && onClarificationSubmit && (
						<div className="w-full max-w-[80%]">
							<ClarificationPanel
								clarification={pendingClarification}
								onSubmit={onClarificationSubmit}
							/>
						</div>
					)}

					{/* Suggested actions */}
					{suggestedActions && suggestedActions.length > 0 && !isStreaming && (
						<div className="w-full max-w-[80%]">
							<SuggestedActions actions={suggestedActions} onSelect={onSuggestedAction} />
						</div>
					)}
				</div>
			</MessagePrimitive>
		);
	},
);

Message.displayName = "Message";

function MessageTimestamp({ createdAt, isViewer }: { createdAt: string; isViewer: boolean }) {
	const formatTime = (dateString: string) => {
		try {
			const date = new Date(dateString);
			return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		} catch {
			return "";
		}
	};

	return (
		<span className={cn("text-xs mt-1 block text-[var(--chat-text-subtle)]", isViewer && "text-right")}>
			{formatTime(createdAt)}
		</span>
	);
}

export { useMessage } from "../primitives";
