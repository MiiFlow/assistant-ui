import { useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChatRenderContext } from "../context/ChatProvider";
import { cn } from "../utils/cn";
import type { MediaChunkData, VisualizationChunkData, TableVisualizationData } from "../types";

/** Exact refs/URLs only: repeated ad names cannot identify a creative. */
export function tableMediaIds(visualizations: VisualizationChunkData[] = [], medias: MediaChunkData[] = []): Set<string> {
	const ids = new Set<string>();
	for (const viz of visualizations) {
		if (viz.type !== "table") continue;
		const data = viz.data as TableVisualizationData;
		for (const column of data.columns || []) {
			if (column.type !== "media") continue;
			for (const row of data.rows || []) {
				const item = parseMediaValue(row[column.key], "table-cell", medias);
				if (item?.url && medias.some(media => media.id === item.id)) ids.add(item.id);
			}
		}
	}
	return ids;
}

// ── Shared media types + helpers ─────────────────────────────────────

export interface MediaItem {
	posterUrl?: string;
	previewUrl?: string;
	id: string;
	url: string;
	mediaType: string;
	altText?: string;
	/** The host's stored-file id for these bytes, when the server sent one.
	 *  Lets a host action (save, reuse, edit) address the file, not the URL. */
	fileAssetId?: string;
	/** Where the media came from before the host proxied or mirrored it. */
	sourceUrl?: string;
}

/** Where a media item is drawn. */
export type MediaActionSurface = "tile" | "lightbox";
/** Which part of the transcript the item belongs to: a message's media
 *  gallery, a user attachment, an inline `media_ref` in the answer text, or a
 *  table cell. */
export type MediaOrigin = "message" | "attachment" | "inline" | "table";
export interface MediaActionContext {
	surface: MediaActionSurface;
	origin: MediaOrigin;
	/** In the lightbox: closes it, for an action that opens the host's own UI
	 *  (a panel, a dialog) in its place. */
	close?: () => void;
}
/** Host-supplied actions for one media item (Save, Edit, …). chat-ui only
 *  places them; it never decides which apply. Return null for none. */
export type RenderMediaActions = (media: MediaItem, context: MediaActionContext) => ReactNode;

/**
 * The host's actions for a media tile. Reads the provider-level
 * `renderMediaActions`; draws nothing when there is none or it returns
 * nothing. `overlay` sits over the tile's bottom-right corner (the tile's
 * container must be `relative`); `below` is a row under it, for inline video
 * players whose own controls occupy the bottom edge. Clicks inside never reach
 * the tile, so an action does not also open the lightbox.
 */
export function MediaTileActions({
	media,
	origin,
	placement = "overlay",
}: {
	media: MediaItem;
	origin: MediaOrigin;
	placement?: "overlay" | "below";
}) {
	const render = useContext(ChatRenderContext)?.renderMediaActions;
	const actions = render?.(media, { surface: "tile", origin });
	if (actions == null || actions === false) return null;
	return (
		// A span: inline media references render inside markdown paragraphs.
		<span
			data-media-actions="tile"
			className={cn(
				"flex gap-1",
				placement === "overlay" ? "absolute bottom-1.5 right-1.5 z-[1]" : "mt-1.5",
			)}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
		>
			{actions}
		</span>
	);
}

export const YOUTUBE_ID_RE =
	/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/;

export const extractYouTubeId = (url: string): string | null => {
	const m = url.match(YOUTUBE_ID_RE);
	return m ? m[1] : null;
};

/** The MediaItem view of a message media record: exactly the fields a tile,
 *  the lightbox and host actions read (not its stream status or context). */
export function toMediaItem(media: {
	id: string;
	url: string;
	mediaType?: string;
	altText?: string;
	posterUrl?: string;
	previewUrl?: string;
	fileAssetId?: string;
	sourceUrl?: string;
}): MediaItem {
	return {
		id: media.id,
		url: media.url,
		mediaType: media.mediaType || "image",
		altText: media.altText,
		posterUrl: media.posterUrl,
		previewUrl: media.previewUrl,
		fileAssetId: media.fileAssetId,
		sourceUrl: media.sourceUrl,
	};
}

/** Parse a table cell / MediaResult-shaped value into a MediaItem.
 *
 * Strings prefixed with `media_ref:<id>` are resolved against the optional
 * `medias` lookup (the message-level media bag emitted alongside tool
 * results). This lets tool outputs reference full media records by id
 * without inlining URLs into every cell.
 */
export function parseMediaValue(
	value: unknown,
	fallbackId: string,
	medias?: ReadonlyArray<{
		id: string;
		url: string;
		mediaType?: string;
		altText?: string;
		sourceUrl?: string;
		fileAssetId?: string;
		posterUrl?: string;
		previewUrl?: string;
	}>,
): MediaItem | null {
	if (typeof value === "string") {
		const raw = value.trim();
		if (!raw) return null;
		if (raw.startsWith("media_ref:")) {
			const refId = raw.slice("media_ref:".length);
			const hit = medias?.find((m) => m.id === refId);
			if (!hit) return null;
			return {
				id: hit.id,
				url: hit.url,
				mediaType:
					hit.mediaType ||
					(YOUTUBE_ID_RE.test(hit.url) ||
					/\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(hit.url)
						? "video"
						: "image"),
				altText: hit.altText,
				posterUrl: hit.posterUrl,
				previewUrl: hit.previewUrl,
				fileAssetId: hit.fileAssetId,
				sourceUrl: hit.sourceUrl,
			};
		}
		const matched = medias?.find((m) => m.sourceUrl === raw || m.url === raw);
		if (matched) return toMediaItem(matched);
		if (!/^(https?:\/\/|\/|blob:|data:image\/)/i.test(raw)) return null;
		const url = raw;
		const isVideo =
			YOUTUBE_ID_RE.test(url) || /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(url);
		return {
			id: fallbackId,
			url,
			mediaType: isVideo ? "video" : "image",
		};
	}
	if (value && typeof value === "object") {
		const v = value as Record<string, unknown>;
		const rawUrl = (v.url || v.image_url || v.video_url) as string | undefined;
		const matched = medias?.find((m) => (!!v.id && m.id === v.id) || (!!rawUrl && (m.sourceUrl === rawUrl || m.url === rawUrl)));
		const url = matched?.url || rawUrl;
		if (!url || typeof url !== "string") return null;
		const type = (v.media_type || v.mediaType || v.type || matched?.mediaType) as
			| string
			| undefined;
		const alt = (v.alt || v.alt_text || v.altText) as string | undefined;
		const id = (matched?.id || (v.id as string) || fallbackId) as string;
		return {
			id,
			url,
			mediaType:
				type ||
				(YOUTUBE_ID_RE.test(url) || /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(url)
					? "video"
					: "image"),
			altText: alt,
			posterUrl: matched?.posterUrl || (v.poster_url || v.posterUrl) as string | undefined,
			previewUrl: matched?.previewUrl || (v.preview_url || v.previewUrl) as string | undefined,
			fileAssetId: matched?.fileAssetId || (v.file_asset_id || v.fileAssetId) as string | undefined,
			sourceUrl: matched?.sourceUrl || (v.source_url || v.sourceUrl) as string | undefined,
		};
	}
	return null;
}

// ── Play overlay shared by grid tile + inline video preview ──────────

export const PlayOverlay = ({ label }: { label: string }) => (
	<div
		className={cn(
			"absolute inset-0 flex cursor-pointer items-center justify-center",
			"bg-black/20 transition-colors hover:bg-black/35",
		)}
		aria-label={label}
	>
		<div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 shadow-lg">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
				<path d="M8 5v14l11-7z" />
			</svg>
		</div>
	</div>
);

// ── Lightbox ──────────────────────────────────────────────────────────

export interface MediaLightboxProps {
	items: MediaItem[];
	index: number;
	onClose: () => void;
	onNavigate: (direction: -1 | 1) => void;
	/** Actions for the item on screen, drawn under it. Defaults to the
	 *  provider-level `renderMediaActions`; pass `() => null` to show none. */
	renderActions?: RenderMediaActions;
	/** Passed to the provider-level `renderMediaActions`. Defaults to "message". */
	origin?: MediaOrigin;
}

/**
 * Viewport-level lightbox for images/videos. Rendered via createPortal into
 * document.body so it escapes transformed ancestors (common in chat scroll
 * containers) and anchors to the real viewport.
 *
 * Keyboard: Esc closes, ArrowLeft/ArrowRight navigate between items.
 * Click outside the media closes; clicks on the media itself do not.
 * Body scroll is locked while open.
 */
export function MediaLightbox({
	items,
	index,
	onClose,
	onNavigate,
	renderActions,
	origin = "message",
}: MediaLightboxProps) {
	const active = items[index];
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const providerActions = useContext(ChatRenderContext)?.renderMediaActions;

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			// Keys pressed inside a host action (a menu, a text field) are the
			// action's own, not the viewer's navigation.
			if (e.target instanceof Element && e.target.closest("[data-media-actions]")) return;
			if (e.key === "Escape") onClose();
			else if (e.key === "ArrowLeft") onNavigate(-1);
			else if (e.key === "ArrowRight") onNavigate(1);
		};
		window.addEventListener("keydown", handleKey);

		const prevOverflow =
			typeof document !== "undefined" ? document.body.style.overflow : "";
		if (typeof document !== "undefined") {
			document.body.style.overflow = "hidden";
		}

		return () => {
			window.removeEventListener("keydown", handleKey);
			if (typeof document !== "undefined") {
				document.body.style.overflow = prevOverflow;
			}
		};
	}, [onClose, onNavigate]);

	if (!active) return null;
	if (typeof document === "undefined") return null;

	const ytId = active.mediaType === "video" ? extractYouTubeId(active.url) : null;
	const hasMany = items.length > 1;
	const actions = (renderActions ?? providerActions)?.(active, { surface: "lightbox", origin, close: onClose });

	const overlay = (
		<div
			className={cn(
				"fixed inset-0 z-[9999] flex items-center justify-center",
				"bg-black/85 backdrop-blur-sm",
			)}
			role="dialog"
			aria-modal="true"
			aria-label="Media viewer"
			onClick={onClose}
		>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onClose();
				}}
				className={cn(
					"absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center",
					"rounded-full bg-white/10 text-white hover:bg-white/20",
				)}
				aria-label="Close"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
				</svg>
			</button>

			{hasMany && (
				<div
					className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1 text-sm text-white"
					onClick={(e) => e.stopPropagation()}
				>
					{index + 1} / {items.length}
				</div>
			)}

			{hasMany && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onNavigate(-1);
					}}
					className={cn(
						"absolute left-4 z-10 flex h-12 w-12 items-center justify-center",
						"rounded-full bg-white/10 text-white hover:bg-white/20",
					)}
					aria-label="Previous"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
					</svg>
				</button>
			)}

			{hasMany && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onNavigate(1);
					}}
					className={cn(
						"absolute right-4 z-10 flex h-12 w-12 items-center justify-center",
						"rounded-full bg-white/10 text-white hover:bg-white/20",
					)}
					aria-label="Next"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
					</svg>
				</button>
			)}

			<div
				className="flex max-h-[90vh] max-w-[90vw] flex-col items-center"
				onClick={(e) => e.stopPropagation()}
			>
				{failedUrl === active.url ? (
					<p className="text-white" role="status">This media is unavailable. Open the ad preview or refresh the analysis.</p>
				) : active.mediaType === "video" && ytId ? (
					<div
						className="relative overflow-hidden rounded-lg bg-black"
						style={{ width: "min(90vw, 1024px)", aspectRatio: "16 / 9" }}
					>
						<iframe
							src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
							title={active.altText || "Video"}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
							className="absolute inset-0 h-full w-full border-0"
						/>
					</div>
				) : active.mediaType === "video" ? (
					<video
						controls
						autoPlay
						preload="metadata"
						className="block max-h-[85vh] max-w-[90vw] rounded-lg"
					>
						<source src={active.url} onError={() => setFailedUrl(active.url)} />
						Your browser does not support the video tag.
					</video>
				) : (
					<img
						src={active.url}
						onError={() => setFailedUrl(active.url)}
						alt={active.altText || "Image"}
						className="block max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
					/>
				)}
				{active.previewUrl && /^https?:\/\//.test(active.previewUrl) && (
					<a className="mt-2 block text-center text-white underline" href={active.previewUrl} target="_blank" rel="noopener noreferrer">Open in Meta</a>
				)}
				{active.altText && (
					<div className="mt-2 max-w-[90vw] text-center text-sm text-white/80">
						{active.altText}
					</div>
				)}
				{actions != null && actions !== false && (
					<div data-media-actions="lightbox" className="mt-3 flex flex-wrap justify-center gap-2">
						{actions}
					</div>
				)}
			</div>
		</div>
	);

	return createPortal(overlay, document.body);
}

// ── Hook: shared lightbox state ──────────────────────────────────────

/**
 * Convenience hook for any component that wants a lightbox over a list of
 * media items. Handles index state, navigation, and close.
 */
export function useMediaLightbox(items: MediaItem[]) {
	const [index, setIndex] = useState<number | null>(null);

	const open = useCallback((i: number) => setIndex(i), []);
	const close = useCallback(() => setIndex(null), []);
	const navigate = useCallback(
		(direction: -1 | 1) => {
			setIndex((current) => {
				if (current === null || items.length === 0) return current;
				return (current + direction + items.length) % items.length;
			});
		},
		[items.length],
	);

	return { index, open, close, navigate };
}
