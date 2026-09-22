import {
	forwardRef,
	memo,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	MediaLightbox,
	PlayOverlay,
	YOUTUBE_ID_RE,
	useMediaLightbox,
	tableMediaIds,
	type MediaItem,
} from "./MediaLightbox";
import { MessageContent as MessageContentPrimitive, Message as MessagePrimitive } from "../primitives";
import type {
	ChatMessage,
	ClarificationData,
	MediaChunkData,
	ParticipantRole,
	SourceReference,
	StreamingChunk,
	SuggestedAction,
	VisualizationChunkData,
} from "../types";
import { cn } from "../utils/cn";
import { isCreativeReviewMedia, placeUnreferencedCreatives, inlineMediaIds, replaceMediaUrls } from "../utils/media";
import { ChatRenderContext } from "../context/ChatProvider";
import { usePrefersReducedMotion } from "../hooks/use-reduced-motion";
import { Avatar } from "./Avatar";
import { CitationSources } from "./CitationSources";
import { ClarificationPanel } from "./ClarificationPanel";
import { ToolApprovalPanel } from "./ToolApprovalPanel";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { MarkdownContent } from "./MarkdownContent";
import { MessageActionBar } from "./MessageActionBar";
import { MessageAttachments } from "./MessageAttachments";
import { ReasoningStream, buildRunSteps, type RunOutcome } from "./reasoning";
import { SuggestedActions } from "./SuggestedActions";
import { VisualizationRenderer } from "./visualizations";
import { ArtifactList } from "./artifacts";
import {
	parseContentWithInlineMarkers,
	stripInlineMarkers,
	trimPartialTrailingMarker,
} from "../utils/inline-markers";

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
	previewUrl?: string;
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

const LazyHtmlVideo = ({ url, posterUrl, altText, previewUrl }: LazyVideoProps) => {
	const [failed, setFailed] = useState(false);
	const [loaded, setLoaded] = useState(false);
	return (
		<div className="my-3">
			<div
				className="relative overflow-hidden rounded-lg"
				style={{ maxWidth: 640, maxHeight: 512 }}
			>
				{failed ? <p role="status">Video unavailable. Open the ad preview or refresh the analysis.</p> : loaded ? (
					<video
						controls
						autoPlay
						preload="metadata"
						className="block max-h-[512px] w-full rounded-lg"
						poster={posterUrl}
					>
						<source src={url} onError={() => setFailed(true)} />
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
			{previewUrl && /^https?:\/\//.test(previewUrl) && <a href={previewUrl} target="_blank" rel="noopener noreferrer">Open in Meta</a>}
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
		const posterSrc = media.posterUrl || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : undefined);
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
	/** The message data. `ChatMessage` rather than the narrower `MessageData`
	 *  so the component can read `visualizations` / `medias` / `artifacts` off
	 *  the message itself; every added field is optional, so a plain
	 *  `MessageData` still satisfies it. */
	message: ChatMessage;
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
	/** Line shown beside the waiting indicator before the first token. Defaults
	 *  to `message.statusText`, which `useMiiflowChat` fills from the server's
	 *  setup status frames ("Getting started…"). */
	waitingLabel?: string;
	/** Brand mark for the waiting state, supplied by the host: chat-ui is
	 *  published standalone and does not know what the host's logo looks like. */
	waitingMark?: React.ReactNode;
	/**
	 * @deprecated No longer read. Host adapters already reconstruct these into
	 * `reasoning` chunks, so passing them separately made the same run
	 * describable two ways. Kept on the interface so existing callers compile;
	 * remove in the next major.
	 */
	executionPlan?: unknown;
	/** @deprecated No longer read — see `executionPlan`. */
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
	/** Inline downloadable artifacts (PDFs, HTMLs, ...) */
	artifacts?: import("../types").ArtifactChunkData[];
	/** Callback when a user clicks an artifact inline card */
	onArtifactOpen?: (artifact: import("../types").ArtifactChunkData) => void;
	/** Base font size multiplier for markdown rendering */
	baselineFontSize?: number;
	/** Total execution time in seconds (persisted from streaming wall-clock) */
	executionTime?: number;
	/** Epoch ms the in-progress run started. Supply the run's durable start
	 *  (e.g. from a server snapshot) so the streaming elapsed figure stays
	 *  correct across remounts; omit to time from when this component mounted. */
	streamStartedAt?: number;
	/** This turn finished moments ago. Needed only by a host that renders the
	 *  completed message as a DIFFERENT element from the streaming one (a key
	 *  that changes at completion), where the component cannot see the edge
	 *  itself. With a stable key — what `useMiiflowChat` guarantees — the edge
	 *  is observed here and the reasoning steps fold into the "Thought for …"
	 *  line on their own. */
	justCompleted?: boolean;
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
	/** Edit-and-resubmit for the viewer's own messages (ChatGPT-style). When
	 *  provided, a pencil appears in the hover action bar; submitting replaces
	 *  this message and everything after it with a fresh agent turn. */
	onEditSubmit?: (newText: string) => void;
}

/**
 * Styled Message component with grid layout matching the main app.
 * Uses grid to align avatar and content, with reasoning above content.
 * Supports attachments, citations, inline visualizations, and streaming text.
 *
 * Memoised: the transcript re-renders on every streamed token, and a
 * finished message has nothing to redraw. The memo only pays off when the
 * host passes referentially stable callbacks; inline arrows defeat it.
 */
const MessageImpl = forwardRef<HTMLDivElement, MessageProps>(
	(
		{
			message,
			viewerRole = "user",
			className,
			showAvatar = true,
			showTimestamp = true,
			renderMarkdown = true,
			reasoning,
			waitingLabel,
			waitingMark,
			suggestedActions,
			onSuggestedAction,
			reasoningExpanded,
			onReasoningExpandedChange,
			citations,
			visualizations: visualizationsProp,
			medias: mediasProp,
			artifacts: artifactsProp,
			onArtifactOpen,
			baselineFontSize,
			executionTime,
			streamStartedAt,
			justCompleted,
			pendingClarification,
			onClarificationSubmit,
			pendingToolApproval,
			onToolApprove,
			onToolReject,
			renderInlineSuggestedAction,
			onReportIncorrect,
			onConfirmCorrect,
			onEditSubmit,
		},
		ref,
	) => {
		// Render inputs only (null-safe for standalone usage). Deliberately not
		// `ChatContext`: that one carries the message list, which changes on
		// every streamed token and would re-render every message per delta.
		const renderContext = useContext(ChatRenderContext);
		const onVisualizationAction = renderContext?.onVisualizationAction;

		// Renders, media and artifacts travel ON the message from `useMiiflowChat`
		// and from the persisted GraphQL fields. Reading them from the message
		// when the prop is omitted is what lets a consumer render `<Message
		// message={msg} />` and still get inline visualizations — the explicit
		// prop still wins, so hosts that adapt the message themselves are
		// unaffected.
		const visualizations = visualizationsProp ?? message.visualizations;
		const medias = mediasProp ?? message.medias;
		const artifacts = artifactsProp ?? message.artifacts;

		// Edit-and-resubmit state for the viewer's own messages
		const [isEditing, setIsEditing] = useState(false);

		// Case-insensitive comparison for role matching
		const participantRole = (message.participant?.role || "").toLowerCase();
		const viewerRoleLower = (viewerRole || "").toLowerCase();
		const isViewer = participantRole === viewerRoleLower;
		const isAssistant = participantRole === "assistant";
		const isStreaming = message.isStreaming;

		// Filter reasoning chunks for display.
		// `subtask` is kept to replay historical (pre-unified-ReAct) messages.
		const reasoningChunks = useMemo(
			() =>
				reasoning?.filter(
					(c) =>
						c.type === "thinking" ||
						c.type === "tool" ||
						c.type === "observation" ||
						c.type === "planning" ||
						c.type === "subtask" ||
						// Sub-assistant dispatch (dispatch_assistant)
						c.type === "subagent",
				),
			[reasoning],
		);
		// Gate on what the panel will actually DRAW, not on what arrived. The
		// chunk list is non-empty while `buildRunSteps` yields nothing whenever a
		// run's only work so far is an internal tool (`tool_search` opens most
		// turns on a tool-heavy assistant), and gating on the raw list there hid
		// the waiting indicator and mounted a panel that rendered null — a blank
		// row until the first real tool. (`executionPlan` / `executionTimeline`
		// used to open this block on their own and left an empty wrapper the same
		// way.) The steps are built once here and handed down.
		// How the run ended, published by the server on the message. Without it
		// `buildRunSteps` can only see that the stream stopped, and it closed
		// every open tool as `completed` — asserting a success nobody observed.
		const turnOutcome = message.metadata?.turn_outcome as RunOutcome | undefined;
		const reasoningSteps = useMemo(
			() => buildRunSteps(reasoningChunks, !!isStreaming, turnOutcome),
			[reasoningChunks, isStreaming, turnOutcome],
		);
		const hasReasoning = reasoningSteps.length > 0;

		// The panel owns the whole run for an assistant row: the waiting line
		// before the first step, the live steps, and the finished summary are
		// three faces of ONE element of constant header height. Mounting three
		// different components in sequence — typing dots, then a thinking row,
		// then the panel — changed the row's height twice before the first
		// token arrived.
		const answerStarted = !!message.textContent;

		// Not for an answer that is streaming with no step and no waiting line

		// to show: the finished row will have no panel either, so mounting one

		// now would put a header above the text that vanishes at completion.

		const showPanel = isAssistant && (hasReasoning || (!!isStreaming && !answerStarted));

		// Waiting state for non-assistant rows only; the panel covers the
		// assistant's.
		const isWaitingForContent = !showPanel && isStreaming && !message.textContent && !hasReasoning;

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

		// The body is ALWAYS rendered as inline parts — text pieces and the
		// visualizations / suggested actions embedded between them — even when
		// there is not a marker in sight. It used to switch to this shape only
		// once a visualization existed, and React answered the switch by
		// remounting the whole body: the text a reader was following vanished
		// and reappeared the moment a tool returned its chart. A marker still
		// being typed is held back so its raw prefix never shows.
        const placedText = useMemo(() => isStreaming || !renderMarkdown ? message.textContent : placeUnreferencedCreatives(message.textContent || "", medias, visualizations), [message.textContent, medias, visualizations, isStreaming, renderMarkdown]);
		const contentParts = useMemo(() => {
			if (!message.textContent) return null;
			const text = isStreaming ? trimPartialTrailingMarker(placedText || "") : placedText || "";
			return parseContentWithInlineMarkers(replaceMediaUrls(text, medias), true);
		}, [isStreaming, placedText, medias]);

		// Strip inline markers from the plain-text branches. The rich branch
		// resolves media inside Markdown; reaching this plain-text branch
		// with a `[VIZ:…]` or `[SA:…]` still in the text means we could not
		// resolve it, and a bare `[VIZ:9fc0ad9c…]` is never something a reader
		// should see. The inline branch below handles the resolvable ones and
		// does not use this value.
		const cleanTextContent = useMemo(() => {
			if (!message.textContent) return message.textContent;
			return replaceMediaUrls(stripInlineMarkers(message.textContent).trim(), medias);
		}, [message.textContent, medias]);

		const renderContent = () => {
			if (!message.textContent) return null;

			if (!renderMarkdown) {
				return <p className="whitespace-pre-wrap">{cleanTextContent}</p>;
			}

			if (contentParts && contentParts.length > 0) {
				const renderedVizIds = new Set<string>();
				return (
					<>
						{contentParts.map((part, idx) => {
							if (part.type === "text") {
								return (
									<MarkdownContent
                                        medias={medias}
										key={`text-${idx}`}
										isStreaming={!!isStreaming}
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
							// Media markers stripped — rendered below. An unresolvable
							// marker of any kind renders nothing: the render floor.
							return null;
						})}
					</>
				);
			}

			return null;
		};

        const referencedInlineIds = useMemo(() => renderMarkdown ? inlineMediaIds(placedText || "") : new Set<string>(), [placedText, renderMarkdown]);
        const referencedTableIds = useMemo(() => tableMediaIds(visualizations, medias), [visualizations, medias]);
        const deferCreativeGallery = renderMarkdown && isStreaming && medias?.some(isCreativeReviewMedia);
		const filteredMedias: MediaItem[] = useMemo(() => {
			if (!medias || medias.length === 0) return [];
			const textContent = cleanTextContent || "";

			return medias
				.filter((media) => {
					if (referencedTableIds.has(media.id) || referencedInlineIds.has(media.id)) return false;
					if (!media.url || media.status === "pending" || media.status === "failed") return false;
					if (media.mediaType !== "image") return true;
					// Skip media items already rendered inline as markdown images
					return !!media.url && !textContent.includes(media.url);
				})
				.map((m) => ({
					id: m.id,
					url: m.url,
					mediaType: m.mediaType,
					altText: m.altText,
					posterUrl: m.posterUrl,
					previewUrl: m.previewUrl,
				}));
		}, [medias, cleanTextContent, referencedTableIds, referencedInlineIds]);

		const {
			index: lightboxIndex,
			open: openLightbox,
			close: closeLightbox,
			navigate: navigateLightbox,
		} = useMediaLightbox(filteredMedias);

		const renderMediaStatuses = () => (
			<>{(medias || [])
				.filter((media) => !referencedInlineIds.has(media.id) && (media.status === "pending" || media.status === "failed"))
				.map((media) => (
					<p key={media.id} role="status" className="my-3 text-sm text-muted-foreground">
						{media.status === "pending" ? "Loading image…" : media.errorMessage || "Image unavailable."}
					</p>
				))}</>
		);

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
						posterUrl={media.posterUrl}
						previewUrl={media.previewUrl}
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
		const reducedMotion = usePrefersReducedMotion();

		return (
			<MessagePrimitive
				ref={ref}
				message={message}
				viewerRole={viewerRole}
				className={cn("w-full", showFadeIn && "animate-message-in", className)}>
				<div
					className={cn("flex flex-col gap-1 w-full")}
					data-is-viewer={isViewer}>
					{/* Speaker label for screen readers: bubble alignment and color
					    say who is talking only visually. */}
					<span className="sr-only">
						{isViewer ? "You" : (message.participant?.name ?? "Assistant")}
					</span>
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
							<ThinkingIndicator label={waitingLabel ?? message.statusText} />
						</div>
					)}

					{/* The agent's work, above the answer: a rolling window of steps
					    while the run is live, one "Thought for …" line once it ends. */}
					{showPanel && (
						<div className="w-full">
							<ReasoningStream
								isStreaming={isStreaming}
								answerStarted={answerStarted}
								waitingLabel={waitingLabel ?? message.statusText}
								waitingMark={waitingMark}
								chunks={reasoningChunks}
								steps={reasoningSteps}
								executionTime={executionTime}
								streamStartedAt={streamStartedAt}
								justCompleted={justCompleted}
								expanded={reasoningExpanded}
								onExpandedChange={onReasoningExpandedChange}
							/>
						</div>
					)}

					{/* Content row: avatar + message bubble.
					    Attachments count as content: an image sent without a caption
					    is a valid message, and gating this row on text alone made the
					    user's own image vanish from the transcript (the attachments
					    block below lives inside this row). */}
					{(message.textContent || hasAttachments) && (
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
								className={cn(
									isViewer ? (isEditing ? "w-full" : "max-w-[85%]") : "min-w-0 flex-1",
									"flex flex-col",
								)}
								data-message-role={isViewer ? "viewer" : "other"}
								data-agent-message={isAssistant ? "" : undefined}
							>
								{isViewer && isEditing && onEditSubmit ? (
									<UserMessageEditor
										initialText={message.textContent || ""}
										onCancel={() => setIsEditing(false)}
										onSubmit={(newText) => {
											setIsEditing(false);
											onEditSubmit(newText);
										}}
									/>
								) : message.textContent ? (
								<div
									className={cn(
										"rounded-2xl",
										isViewer || showAvatar ? "px-4 py-3" : "",
										// The timestamp and invisible hover actions share the
										// wrapper below. Keep their width from stretching a short
										// viewer bubble and looking like trailing whitespace.
										isViewer && "self-end w-fit max-w-full",
									)}
									style={{
										backgroundColor: isViewer ? "var(--chat-user-message-bg)" : "transparent",
										color: isViewer ? "var(--chat-user-message-text, #ffffff)" : "var(--chat-text)",
									}}>
									<MessageContentPrimitive>{renderContent()}</MessageContentPrimitive>
									{renderMediaStatuses()}
									{!isStreaming && filteredMedias.length > 0 && (referencedInlineIds.size > 0 || referencedTableIds.size > 0) ? (
                                        <details className="my-3"><summary className="cursor-pointer text-sm text-muted-foreground">Additional media ({filteredMedias.length})</summary>{renderMediaItems()}</details>
                                    ) : (!deferCreativeGallery && renderMediaItems())}
									{lightboxIndex !== null && (
										<MediaLightbox
											items={filteredMedias}
											index={lightboxIndex}
											onClose={closeLightbox}
											onNavigate={navigateLightbox}
										/>
									)}

									{/* Unreferenced visualizations (not embedded inline via [VIZ:id]
									    markers). Not while streaming: a render usually lands before
									    the sentence that places it, and showing it at the bottom
									    until then made it jump inline a moment later. Finalize
									    prunes renders the answer never embedded, so what appears
									    here after the stream is exactly what the message keeps. */}
									{!isStreaming && visualizations && visualizations.length > 0 && (() => {
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

									{/* Downloadable artifacts (PDFs, HTMLs) */}
									{artifacts && artifacts.length > 0 && (
										<div className="mt-2">
											<ArtifactList
												artifacts={artifacts}
												isStreaming={isStreaming}
												onOpen={onArtifactOpen}
											/>
										</div>
									)}

									{/* Citations */}
									{citations && citations.length > 0 && (
										<div className="mt-2 pt-2 border-t border-[var(--chat-border)]">
											<CitationSources sources={citations} />
										</div>
									)}
								</div>
								) : null}

								{/* Attachments — outside bubble */}
								{hasAttachments && (
									<div className="mt-2">
										<MessageAttachments
											attachments={attachments}
											align={isViewer ? "end" : "start"}
										/>
									</div>
								)}

								{/* Timestamp + action bar row. For an assistant message the row is
								    in the layout from the first token, invisible, at its real
								    height, so nothing below the answer moves when it completes.
								    The reveal is an opacity fade rather than a visibility snap:
								    the space was always reserved, so completion should read as a
								    landing, not a pop-in. A viewer message is never streaming. */}
								{!isEditing && (!isStreaming || isAssistant) && (showTimestamp && message.createdAt || message.textContent) && (
									<div
										className={cn("flex items-center gap-2 mt-1", isViewer && "flex-row-reverse")}
										style={{
											opacity: isStreaming ? 0 : 1,
											visibility: isStreaming ? "hidden" : "visible",
											transition: reducedMotion
												? undefined
												: "opacity 240ms cubic-bezier(.16,1,.3,1), visibility 0s",
										}}
										aria-hidden={isStreaming ? true : undefined}>
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
										{isViewer && message.textContent && (
											<MessageActionBar
												textContent={message.textContent}
												onEdit={onEditSubmit ? () => setIsEditing(true) : undefined}
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

					{/* Tool approval panel - when tool requires user approval. The
					    gate is not a chat bubble; render it full-width within the
					    message column so it reads as a decision moment rather than
					    a stray suggestion. */}
					{pendingToolApproval && !isStreaming && onToolApprove && onToolReject && (
						<div className="w-full">
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

MessageImpl.displayName = "Message";

export const Message = memo(MessageImpl);

/**
 * Inline editor shown when the viewer edits one of their own messages
 * (ChatGPT-style). Renders in place of the bubble: an auto-growing textarea
 * with Cancel / Send. Esc cancels, Cmd/Ctrl+Enter sends.
 */
function UserMessageEditor({
	initialText,
	onCancel,
	onSubmit,
}: {
	initialText: string;
	onCancel: () => void;
	onSubmit: (newText: string) => void;
}) {
	const [draft, setDraft] = useState(initialText);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const canSubmit = draft.trim().length > 0;

	// Auto-grow the textarea to fit content
	const resize = () => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
	};

	// On mount: focus with the caret at the end, sized to content
	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.focus();
		el.setSelectionRange(el.value.length, el.value.length);
		resize();
	}, []);

	return (
		<div
			className="w-full rounded-2xl px-4 py-3"
			style={{
				backgroundColor: "var(--chat-panel-bg)",
				border: "1px solid var(--chat-border)",
			}}
		>
			<textarea
				ref={textareaRef}
				value={draft}
				onChange={(e) => {
					setDraft(e.target.value);
					resize();
				}}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						onCancel();
					} else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
						e.preventDefault();
						if (canSubmit) onSubmit(draft.trim());
					}
				}}
				rows={1}
				aria-label="Edit message"
				className="w-full resize-none border-0 bg-transparent p-0 outline-none text-[var(--chat-text)]"
				style={{ font: "inherit", lineHeight: "inherit", overflowY: "auto" }}
			/>
			<div className="mt-2 flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					className={cn(
						"rounded-full px-3.5 py-1.5 text-sm font-medium",
						"text-[var(--chat-text)] hover:opacity-80 transition-opacity",
					)}
					style={{ border: "1px solid var(--chat-border)", backgroundColor: "transparent" }}
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={() => canSubmit && onSubmit(draft.trim())}
					disabled={!canSubmit}
					className={cn(
						"rounded-full px-3.5 py-1.5 text-sm font-medium",
						"transition-opacity",
						canSubmit ? "hover:opacity-90" : "opacity-40 cursor-not-allowed",
					)}
					style={{
						backgroundColor: "var(--chat-user-message-bg)",
						color: "var(--chat-user-message-text, #ffffff)",
						border: "none",
					}}
				>
					Send
				</button>
			</div>
		</div>
	);
}

function MessageTimestamp({ createdAt }: { createdAt: string; isViewer?: boolean }) {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime())) return null;

	// Visible text stays clock-only (day dividers carry the date), but the
	// element exposes the full timestamp: `dateTime` for machines, and a full
	// date + time label so screen readers and hover tooltips get the day the
	// clock-only text omits.
	const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	const full = `${date.toLocaleDateString([], { dateStyle: "long" })}, ${time}`;

	return (
		<time
			dateTime={date.toISOString()}
			title={full}
			aria-label={full}
			className="text-xs text-[var(--chat-text-subtle)]"
		>
			{time}
		</time>
	);
}

export { useMessage } from "../primitives";
