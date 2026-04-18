import {
	forwardRef,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	MediaLightbox,
	PlayOverlay,
	YOUTUBE_ID_RE,
	useMediaLightbox,
	type MediaItem,
} from "./MediaLightbox";
import { MessageContent as MessageContentPrimitive, Message as MessagePrimitive } from "../primitives";
import type {
	ClarificationData,
	MediaChunkData,
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
import { ToolApprovalPanel } from "./ToolApprovalPanel";
import { LoadingDots } from "./LoadingDots";
import { MarkdownContent } from "./MarkdownContent";
import { MessageActionBar } from "./MessageActionBar";
import { MessageAttachments } from "./MessageAttachments";
import { ReasoningPanel } from "./ReasoningPanel";
import { StreamingText } from "./StreamingText";
import { SuggestedActions } from "./SuggestedActions";
import { VisualizationRenderer } from "./visualizations";
import { parseContentWithInlineMarkers } from "../utils/inline-markers";
import { useStreamingMinHeight } from "../hooks/use-streaming-min-height";

// ── Lazy media helpers ───────────────────────────────────────────────
// Videos are mounted only after the user clicks the poster. This keeps
// long audit lists (top 5 + bottom 5, possibly dozens of videos) from
// instantiating every <video>/<iframe> on initial render.
// MediaItem / YOUTUBE_ID_RE / PlayOverlay / MediaLightbox are imported
// from ./MediaLightbox so TableVisualization can reuse them.

interface LazyVideoProps {
	url: string;
	posterUrl?: string;
	altText?: string;
}

const LazyYouTubeEmbed = ({ ytId, altText }: { ytId: string; altText?: string }) => {
	const [loaded, setLoaded] = useState(false);
	const posterUrl = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
	return (
		<div className="my-3">
			<div
				className="relative w-full overflow-hidden rounded-lg"
				style={{ maxWidth: 640, aspectRatio: "16 / 9" }}
			>
				{loaded ? (
					<iframe
						src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
						title={altText || "Video"}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
						className="absolute inset-0 h-full w-full border-0"
					/>
				) : (
					<button
						type="button"
						onClick={() => setLoaded(true)}
						className="absolute inset-0 block border-0 bg-transparent p-0"
						aria-label={altText || "Play video"}
					>
						<img
							src={posterUrl}
							alt={altText || "Video preview"}
							className="h-full w-full object-cover"
							loading="lazy"
						/>
						<PlayOverlay label={altText || "Play video"} />
					</button>
				)}
			</div>
			{altText && <div className="mt-1 text-xs text-gray-500">{altText}</div>}
		</div>
	);
};

const LazyHtmlVideo = ({ url, posterUrl, altText }: LazyVideoProps) => {
	const [loaded, setLoaded] = useState(false);
	return (
		<div className="my-3">
			<div
				className="relative overflow-hidden rounded-lg"
				style={{ maxWidth: 640, maxHeight: 512 }}
			>
				{loaded ? (
					<video
						controls
						autoPlay
						preload="metadata"
						className="block max-h-[512px] w-full rounded-lg"
						poster={posterUrl}
					>
						<source src={url} />
						Your browser does not support the video tag.
					</video>
				) : (
					<button
						type="button"
						onClick={() => setLoaded(true)}
						className="block w-full border-0 bg-transparent p-0"
						aria-label={altText || "Play video"}
					>
						{posterUrl ? (
							<img
								src={posterUrl}
								alt={altText || "Video preview"}
								className="block max-h-[512px] w-full object-cover"
								loading="lazy"
							/>
						) : (
							<div
								className="flex w-full items-center justify-center bg-gray-900 text-gray-400"
								style={{ aspectRatio: "16 / 9" }}
							>
								<span className="text-sm">Click to load video</span>
							</div>
						)}
						<PlayOverlay label={altText || "Play video"} />
					</button>
				)}
			</div>
			{altText && <div className="mt-1 text-xs text-gray-500">{altText}</div>}
		</div>
	);
};

// ── Media grid ────────────────────────────────────────────────────────
// When a tool returns multiple media items (creative audits return 5-10+),
// a vertical stack wastes screen real estate. The grid tiles the items
// responsively; click opens a full-size lightbox with keyboard navigation.
// MediaLightbox itself lives in ./MediaLightbox so TableVisualization can
// reuse it.

const MediaGridTile = ({
	media,
	onOpen,
}: {
	media: MediaItem;
	onOpen: () => void;
}) => {
	// Video (YouTube or direct): show thumbnail with play overlay; click opens lightbox.
	if (media.mediaType === "video") {
		const ytMatch = media.url.match(YOUTUBE_ID_RE);
		const ytId = ytMatch ? ytMatch[1] : null;
		const posterSrc = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : undefined;
		return (
			<button
				type="button"
				onClick={onOpen}
				className={cn(
					"relative block w-full overflow-hidden rounded-lg border-0 bg-black/5 p-0",
					"aspect-square cursor-pointer transition-opacity hover:opacity-90",
				)}
				style={{ aspectRatio: "1 / 1" }}
				aria-label={media.altText || "Open video"}
			>
				{posterSrc ? (
					<img
						src={posterSrc}
						alt={media.altText || "Video preview"}
						className="h-full w-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-gray-900 text-xs text-gray-400">
						Video
					</div>
				)}
				<PlayOverlay label={media.altText || "Open video"} />
			</button>
		);
	}

	// Image: click opens lightbox at full size.
	return (
		<button
			type="button"
			onClick={onOpen}
			className={cn(
				"block w-full overflow-hidden rounded-lg border-0 bg-transparent p-0",
				"aspect-square cursor-pointer transition-opacity hover:opacity-90",
			)}
			style={{ aspectRatio: "1 / 1" }}
			aria-label={media.altText || "Open image"}
		>
			<img
				src={media.url}
				alt={media.altText || "Image"}
				className="h-full w-full object-cover"
				loading="lazy"
			/>
		</button>
	);
};

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
	/** Inline media (images/videos) to render within message content */
	medias?: MediaChunkData[];
	/** Base font size multiplier for markdown rendering */
	baselineFontSize?: number;
	/** Total execution time in seconds (persisted from streaming wall-clock) */
	executionTime?: number;
	/** Pending clarification data (agent needs user input) */
	pendingClarification?: ClarificationData;
	/** Callback when user responds to a clarification */
	onClarificationSubmit?: (response: string) => void;
	/** Pending tool approval data (tool requires user approval) */
	pendingToolApproval?: import("../types").ToolApprovalData;
	/** Callback when user approves a tool execution */
	onToolApprove?: (modifiedInputs: Record<string, unknown>) => void;
	/** Callback when user rejects a tool execution */
	onToolReject?: (reason?: string) => void;
	/** Render function for inline suggested action cards (from [SA:id] markers) */
	renderInlineSuggestedAction?: (id: string) => React.ReactNode;
	/** Report this assistant response as incorrect. Receives an optional reason
	 *  string (category + free-text details) for the learner pipeline. */
	onReportIncorrect?: (reason?: string) => void;
	/** Confirm this assistant response was correct/helpful */
	onConfirmCorrect?: () => void;
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
			medias,
			baselineFontSize,
			executionTime,
			pendingClarification,
			onClarificationSubmit,
			pendingToolApproval,
			onToolApprove,
			onToolReject,
			renderInlineSuggestedAction,
			onReportIncorrect,
			onConfirmCorrect,
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

		// Parse content for inline viz/SA markers
		const hasVizInlineContent = vizMap && vizMap.size > 0;
		const hasInlineMarkers = hasVizInlineContent || (message.textContent && /\[SA:[\w-]+\]/i.test(message.textContent));
		const contentParts = useMemo(() => {
			if (!hasInlineMarkers || !message.textContent) return null;
			return parseContentWithInlineMarkers(message.textContent);
		}, [hasInlineMarkers, message.textContent]);

		// Strip [MEDIA:...] markers from text content (media rendered separately)
		const cleanTextContent = useMemo(() => {
			if (!medias || medias.length === 0 || !message.textContent) return message.textContent;
			return message.textContent.replace(/\[MEDIA:[a-f0-9-]+\]/gi, "").trim();
		}, [message.textContent, medias]);

		const renderContent = () => {
			if (!message.textContent) return null;

			// Content with inline visualization/suggested action markers
			if (contentParts && contentParts.length > 0 && hasInlineMarkers) {
				const renderedVizIds = new Set<string>();
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
							if (part.type === "viz") {
								if (renderedVizIds.has(part.id)) return null;
								const viz = vizMap?.get(part.id);
								if (viz) {
									renderedVizIds.add(part.id);
									return <VisualizationRenderer key={`viz-${part.id}`} data={viz} isStreaming={isStreaming} onAction={onVisualizationAction} medias={medias} />;
								}
								return null;
							}
							if (part.type === "sa") {
								if (renderInlineSuggestedAction) {
									return <div key={`sa-${part.id}`}>{renderInlineSuggestedAction(part.id)}</div>;
								}
								return null;
							}
							// Media markers stripped — rendered below
							return null;
						})}
					</>
				);
			}

			// Streaming text with typewriter
			if (isStreaming && renderMarkdown) {
				return (
					<StreamingText
						content={cleanTextContent || ""}
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
						{cleanTextContent || ""}
					</MarkdownContent>
				);
			}

			return <p className="whitespace-pre-wrap">{cleanTextContent}</p>;
		};

		const filteredMedias: MediaItem[] = useMemo(() => {
			if (!medias || medias.length === 0) return [];
			const textContent = cleanTextContent || "";
			return medias
				.filter((media) => {
					if (media.mediaType !== "image") return true;
					// Skip media items already rendered inline as markdown images
					return !textContent.includes(media.url);
				})
				.map((m) => ({
					id: m.id,
					url: m.url,
					mediaType: m.mediaType,
					altText: m.altText,
				}));
		}, [medias, cleanTextContent]);

		const {
			index: lightboxIndex,
			open: openLightbox,
			close: closeLightbox,
			navigate: navigateLightbox,
		} = useMediaLightbox(filteredMedias);

		const renderMediaItems = () => {
			if (filteredMedias.length === 0) return null;

			// Grid view for 2+ items — tiles click into the lightbox.
			if (filteredMedias.length >= 2) {
				return (
					<div
						className="my-3 grid gap-2"
						style={{
							gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
							maxWidth: 640,
						}}
					>
						{filteredMedias.map((media, idx) => (
							<MediaGridTile
								key={`media-${media.id}`}
								media={media}
								onOpen={() => openLightbox(idx)}
							/>
						))}
					</div>
				);
			}

			// Single-item rendering keeps the existing larger layout but adds
			// click-to-open-lightbox so users can still get a full-size view.
			const media = filteredMedias[0];
			if (media.mediaType === "image") {
				return (
					<div className="my-3">
						<button
							type="button"
							onClick={() => openLightbox(0)}
							className="block cursor-zoom-in border-0 bg-transparent p-0"
							aria-label={media.altText || "Open image"}
						>
							<img
								src={media.url}
								alt={media.altText || "Generated image"}
								className="max-w-full rounded-lg"
								loading="lazy"
								style={{ maxHeight: 512, display: "block" }}
							/>
						</button>
					</div>
				);
			}
			if (media.mediaType === "video") {
				const ytMatch = media.url.match(YOUTUBE_ID_RE);
				if (ytMatch) {
					return (
						<LazyYouTubeEmbed
							key={`media-${media.id}`}
							ytId={ytMatch[1]}
							altText={media.altText}
						/>
					);
				}
				return (
					<LazyHtmlVideo
						key={`media-${media.id}`}
						url={media.url}
						posterUrl={(media as { posterUrl?: string }).posterUrl}
						altText={media.altText}
					/>
				);
			}
			return null;
		};

		// Track if this message was ever in streaming state.
		// Streamed messages are already visible — re-animating them on completion causes a flash.
		const wasStreamingRef = useRef(isStreaming);
		if (isStreaming) wasStreamingRef.current = true;
		const showFadeIn = !isStreaming && !wasStreamingRef.current;

		// Reserve vertical space for streaming text bodies (off-DOM measurement
		// via @chenglou/pretext) so the scroll anchor doesn't jitter per token.
		const bubbleRef = useRef<HTMLDivElement>(null);
		const streamingMinHeight = useStreamingMinHeight(
			bubbleRef,
			message.textContent,
			!!isStreaming,
		);

		return (
			<MessagePrimitive
				ref={ref}
				message={message}
				viewerRole={viewerRole}
				className={cn("w-full", showFadeIn && "animate-message-in", className)}>
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
								userMessageTimestamp={message.createdAt ? new Date(typeof message.createdAt === "string" ? message.createdAt : message.createdAt).getTime() / 1000 : undefined}
								executionTime={executionTime}
								expanded={reasoningExpanded}
								onExpandedChange={onReasoningExpandedChange}
							/>
						</div>
					)}

					{/* Content row: avatar + message bubble */}
					{message.textContent && (
						<div className={cn(
							"group flex items-start gap-2 w-full",
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
							<div
								ref={bubbleRef}
								className={cn("max-w-[85%]", "flex flex-col")}
								data-message-role={isViewer ? "viewer" : "other"}
								style={streamingMinHeight ? { minHeight: streamingMinHeight } : undefined}
							>
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
									{renderMediaItems()}
									{lightboxIndex !== null && (
										<MediaLightbox
											items={filteredMedias}
											index={lightboxIndex}
											onClose={closeLightbox}
											onNavigate={navigateLightbox}
										/>
									)}

									{/* Unreferenced visualizations (not embedded inline via [VIZ:id] markers) */}
									{visualizations && visualizations.length > 0 && (() => {
										const textContent = message.textContent || "";
										const unreferenced = visualizations.filter(
											(viz) => !textContent.includes(`[VIZ:${viz.id}]`)
										);
										if (unreferenced.length === 0) return null;
										return unreferenced.map((viz) => (
											<div key={`viz-unreferenced-${viz.id}`} className="my-3">
												<VisualizationRenderer
													data={viz}
													isStreaming={isStreaming}
													onAction={onVisualizationAction}
													medias={medias}
												/>
											</div>
										));
									})()}

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

								{/* Timestamp + action bar row */}
								{!isStreaming && (showTimestamp && message.createdAt || (isAssistant && message.textContent)) && (
									<div className={cn("flex items-center gap-2 mt-1", isViewer && "flex-row-reverse")}>
										{showTimestamp && message.createdAt && (
											<MessageTimestamp
												createdAt={
													typeof message.createdAt === "string" ? message.createdAt : message.createdAt.toISOString()
												}
												isViewer={isViewer}
											/>
										)}
										{isAssistant && message.textContent && (
											<MessageActionBar
												textContent={message.textContent}
												onReportIncorrect={onReportIncorrect}
												onConfirmCorrect={onConfirmCorrect}
											/>
										)}
									</div>
								)}
							</div>
						</div>
					)}

					{/* Message error display */}
					{message.error && (
						<div
							className={cn(
								"flex items-start gap-2 w-full max-w-[85%]",
								"rounded-lg border px-3 py-2 mt-1",
							)}
							style={{
								borderColor: "var(--chat-error, #B1001B)",
								backgroundColor: "color-mix(in srgb, var(--chat-error, #B1001B) 6%, transparent)",
								color: "var(--chat-error, #B1001B)",
							}}
						>
							{/* Alert triangle icon */}
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="flex-shrink-0 mt-0.5"
							>
								<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
								<line x1="12" y1="9" x2="12" y2="13" />
								<line x1="12" y1="17" x2="12.01" y2="17" />
							</svg>
							<span className="text-sm">{message.error.message}</span>
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

					{/* Tool approval panel - when tool requires user approval */}
					{pendingToolApproval && !isStreaming && onToolApprove && onToolReject && (
						<div className="w-full max-w-[80%]">
							<ToolApprovalPanel
								approval={pendingToolApproval}
								onApprove={onToolApprove}
								onReject={onToolReject}
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

function MessageTimestamp({ createdAt }: { createdAt: string; isViewer?: boolean }) {
	const formatTime = (dateString: string) => {
		try {
			const date = new Date(dateString);
			return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		} catch {
			return "";
		}
	};

	return (
		<span className="text-xs text-[var(--chat-text-subtle)]">
			{formatTime(createdAt)}
		</span>
	);
}

export { useMessage } from "../primitives";
