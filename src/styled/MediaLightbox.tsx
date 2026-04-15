import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";

// ── Shared media types + helpers ─────────────────────────────────────

export interface MediaItem {
	id: string;
	url: string;
	mediaType: string;
	altText?: string;
}

export const YOUTUBE_ID_RE =
	/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/;

export const extractYouTubeId = (url: string): string | null => {
	const m = url.match(YOUTUBE_ID_RE);
	return m ? m[1] : null;
};

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
	}>,
): MediaItem | null {
	if (typeof value === "string") {
		const raw = value.trim();
		if (!raw) return null;
		if (raw.startsWith("media_ref:") && medias && medias.length > 0) {
			const refId = raw.slice("media_ref:".length);
			const hit = medias.find((m) => m.id === refId);
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
			};
		}
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
		const url = (v.url || v.image_url || v.video_url) as string | undefined;
		if (!url || typeof url !== "string") return null;
		const type = (v.media_type || v.mediaType || v.type) as
			| string
			| undefined;
		const alt = (v.alt || v.alt_text || v.altText) as string | undefined;
		const id = ((v.id as string) || fallbackId) as string;
		return {
			id,
			url,
			mediaType:
				type ||
				(YOUTUBE_ID_RE.test(url) || /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(url)
					? "video"
					: "image"),
			altText: alt,
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
}: MediaLightboxProps) {
	const active = items[index];

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
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
				{active.mediaType === "video" && ytId ? (
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
						<source src={active.url} />
						Your browser does not support the video tag.
					</video>
				) : (
					<img
						src={active.url}
						alt={active.altText || "Image"}
						className="block max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
					/>
				)}
				{active.altText && (
					<div className="mt-2 max-w-[90vw] text-center text-sm text-white/80">
						{active.altText}
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
