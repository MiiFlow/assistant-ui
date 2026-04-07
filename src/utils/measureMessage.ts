/**
 * Off-DOM text measurement for chat message bodies.
 *
 * Wraps `@chenglou/pretext` (canvas-based, no layout reflow) so callers can
 * compute a paragraph's pixel height before React renders it. Used to reserve
 * vertical space for streaming assistant messages and prevent scroll jitter.
 *
 * Notes:
 * - We avoid `system-ui` in the font shorthand because pretext is inaccurate
 *   with it on macOS. The font family stays in sync with `--chat-font-family`
 *   minus the `system-ui` token.
 * - The cache is a small FIFO keyed by `(text, font, maxWidth, lineHeight)`.
 *   Chat threads are bounded so this stays cheap.
 */

import { clearCache, layout, prepare } from "@chenglou/pretext";
import { chatTokens } from "../styles/tokens";

export interface MeasureOptions {
	/** CSS font shorthand. Defaults to the chat message body font. */
	font?: string;
	/** Line height in pixels. Defaults to message body fontSize × lineHeight. */
	lineHeightPx?: number;
}

export interface MeasuredText {
	height: number;
	lineCount: number;
}

const DEFAULT_FONT_PX = 16; // matches chatTokens.typography.message.fontSize "1rem"
const DEFAULT_LINE_HEIGHT_PX =
	DEFAULT_FONT_PX * chatTokens.typography.message.lineHeight;

const DEFAULT_FONT = `400 ${DEFAULT_FONT_PX}px "Inter", "Assistant", -apple-system, sans-serif`;

const CACHE_MAX = 512;
const cache = new Map<string, MeasuredText>();

function cacheGet(key: string): MeasuredText | undefined {
	const hit = cache.get(key);
	if (hit) {
		// LRU bump
		cache.delete(key);
		cache.set(key, hit);
	}
	return hit;
}

function cacheSet(key: string, value: MeasuredText): void {
	cache.set(key, value);
	if (cache.size > CACHE_MAX) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
}

/**
 * Measure the rendered height of a plain-text message body without touching
 * the DOM. Returns `null` if measurement is not possible in this environment
 * (e.g. SSR, no canvas).
 */
export function measureMessageHeight(
	text: string,
	maxWidth: number,
	options: MeasureOptions = {},
): MeasuredText | null {
	if (!text || maxWidth <= 0) return { height: 0, lineCount: 0 };
	if (typeof document === "undefined") return null;

	const font = options.font ?? DEFAULT_FONT;
	const lineHeightPx = options.lineHeightPx ?? DEFAULT_LINE_HEIGHT_PX;

	// Snap maxWidth so subpixel container resizes share cache entries.
	const snappedWidth = Math.round(maxWidth);
	const key = `${font}|${lineHeightPx}|${snappedWidth}|${text}`;

	const cached = cacheGet(key);
	if (cached) return cached;

	try {
		const prepared = prepare(text, font);
		const result = layout(prepared, snappedWidth, lineHeightPx);
		const measured: MeasuredText = {
			height: result.height,
			lineCount: result.lineCount,
		};
		cacheSet(key, measured);
		return measured;
	} catch {
		return null;
	}
}

/**
 * Drop pretext's internal caches and our LRU. Call after the active font
 * family changes (e.g. branding swap) so measurements use the new metrics.
 */
export function clearMeasurementCache(): void {
	cache.clear();
	try {
		clearCache();
	} catch {
		/* pretext may not be loaded in SSR */
	}
}
