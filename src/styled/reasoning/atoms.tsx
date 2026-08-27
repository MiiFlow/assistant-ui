import type { CSSProperties } from "react";

/** Themed through the chat token so every surface resolves the same stack. */
export const MONO_STACK = "var(--chat-font-mono)";

/** The one easing this panel animates on. */
export const EASE = "cubic-bezier(.16,1,.3,1)";

/**
 * Compact "tool call" mark — Lucide-style 3/4-view open-end wrench.
 *
 * Colour inherits via `currentColor` so the chip can tint it per state.
 */
export function ToolCallMark({ size = 12 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.25"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
			style={{ flexShrink: 0, display: "block" }}
		>
			<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
		</svg>
	);
}

/**
 * Text-shimmer for live prose: a gradient masked by the glyph shapes sweeps
 * through the characters, so the *text itself* shimmers rather than a
 * background behind it. Basis colour is `--chat-text`, so it adapts to theme.
 */
export const TEXT_SHIMMER_STYLE: CSSProperties = {
	backgroundImage:
		"linear-gradient(90deg, var(--chat-text) 0%, var(--chat-text) 40%, color-mix(in srgb, var(--chat-text) 35%, transparent) 50%, var(--chat-text) 60%, var(--chat-text) 100%)",
	backgroundSize: "200% 100%",
	backgroundRepeat: "repeat-x",
	backgroundClip: "text",
	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",
	color: "transparent",
	animation: "mf-text-shimmer 2.4s linear infinite",
};

/** `4.2s` / `780ms` — a figure to read, not to compare. */
export function formatDuration(seconds: number): string {
	if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const total = Math.round(seconds);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Live counter: `42s` under a minute, `2:07` beyond it. Agent runs routinely
 * pass a minute, and `127s` reads worse than `2:07` at a glance.
 */
export function formatElapsed(seconds: number): string {
	const total = Math.floor(seconds);
	if (total < 60) return `${total}s`;
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Ink opacity scale — the panel's whole palette is `--chat-text` at N%. */
export const ink = (percent: number) =>
	`color-mix(in srgb, var(--chat-text) ${percent}%, transparent)`;
