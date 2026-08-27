import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/use-reduced-motion";
import { injectBeamerKeyframes } from "../utils/beamer";
import { cn } from "../utils/cn";

/** Hex, because a hash resolving is the thing this is meant to feel like. */
const GLYPHS = "0123456789abcdef";
/** How often the unresolved tail re-rolls. Fast enough to churn, slow enough
 *  to read as characters rather than as a blur. */
const ROLL_MS = 45;
/** How long each character waits its turn. Capped so a long line still lands. */
const PER_CHAR_MS = 34;
const MAX_DECODE_MS = 900;

/**
 * One frame of the decode: everything left of the wavefront is settled, the
 * rest is noise.
 *
 * Pure, and exported, because it is the only part of this component with logic
 * worth checking and the effect that drives it runs too fast to catch from the
 * outside — a screenshot or a MutationObserver both arrive after it has landed.
 *
 * @param progress 0 → all noise, 1 → the real text.
 * @param frame    Increments per roll so the unresolved tail churns instead of
 *                 freezing on one arrangement between settles.
 */
export function decodeFrame(text: string, progress: number, frame: number): string {
	const clamped = Math.min(1, Math.max(0, progress));
	const settled = Math.floor(clamped * text.length);
	return text
		.split("")
		.map((ch, i) => {
			// Spaces are never scrambled, so word shapes surface before the
			// letters do and the eye can start reading early.
			if (i < settled || ch === " ") return ch;
			return GLYPHS[(i * 7 + frame * 3) % GLYPHS.length];
		})
		.join("");
}

/**
 * Text that resolves out of noise, left to right.
 *
 * The pre-first-token window is dead air — the model is loading tools and
 * assembling a prompt, and there is genuinely nothing to report yet. Three
 * bouncing dots fill it by saying "wait"; this fills it by looking like
 * something is being computed, which is truer and buys the same second.
 *
 */
function DecodingText({ text, className }: { text: string; className?: string }) {
	const reducedMotion = usePrefersReducedMotion();
	const [shown, setShown] = useState(reducedMotion ? text : "");

	useEffect(() => {
		if (reducedMotion) {
			setShown(text);
			return;
		}
		const total = Math.min(text.length * PER_CHAR_MS, MAX_DECODE_MS);
		const start = performance.now();
		let frame = 0;

		const id = setInterval(() => {
			const progress = Math.min(1, (performance.now() - start) / total);
			frame += 1;
			setShown(decodeFrame(text, progress, frame));
			if (progress >= 1) clearInterval(id);
		}, ROLL_MS);

		return () => clearInterval(id);
	}, [text, reducedMotion]);

	return (
		<span
			className={className}
			data-decoding={shown === text ? undefined : "true"}
			style={{
				// Tabular figures keep the line from reflowing as glyphs resolve:
				// a proportional `1` next to a proportional `m` would make the
				// whole label twitch on every roll.
				fontVariantNumeric: "tabular-nums",
				fontVariantLigatures: "none",
			}}
		>
			{shown}
		</span>
	);
}

export interface ThinkingIndicatorProps {
	/**
	 * Brand mark shown while the agent starts up. Supplied by the host, which
	 * owns its own logo and its own image loader; this package renders the
	 * motion around whatever it is given. Omit it for the plain form.
	 */
	mark?: ReactNode;
	/** Status line, e.g. "Getting started…". Resolves out of noise. */
	label?: string | null;
	className?: string;
}

/**
 * The waiting state before the first token.
 *
 * A mark with a breathing halo, beside a line of text decoding itself. Both
 * halves are the same idea: something is being worked out, and it is nearly
 * here.
 */
export function ThinkingIndicator({ mark, label, className }: ThinkingIndicatorProps) {
	const ref = useRef<HTMLDivElement>(null);
	const reducedMotion = usePrefersReducedMotion();
	useEffect(() => {
		injectBeamerKeyframes(ref.current);
	}, []);

	return (
		<div ref={ref} className={cn("inline-flex items-center gap-2.5 px-4 py-3", className)}>
			<span
				aria-hidden
				style={{
					position: "relative",
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: 22,
					height: 22,
					flexShrink: 0,
				}}
			>
				{/* Halo. The one branded note: `--chat-primary` is set per-org by the
				    host's theming, so this is the customer's own colour rather than a
				    hue picked here. */}
				<span
					style={{
						position: "absolute",
						inset: -7,
						borderRadius: "50%",
						background:
							"radial-gradient(closest-side, color-mix(in srgb, var(--chat-primary) 26%, transparent), transparent 72%)",
						animation: reducedMotion
							? undefined
							: "mf-halo-breathe 2.6s cubic-bezier(.16,1,.3,1) infinite",
						opacity: reducedMotion ? 0.5 : undefined,
						pointerEvents: "none",
					}}
				/>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						width: 20,
						height: 20,
						animation: reducedMotion
							? undefined
							: "mf-mark-breathe 2.6s cubic-bezier(.16,1,.3,1) infinite",
					}}
				>
					{mark ?? <FallbackMark />}
				</span>
			</span>

			{label ? (
				<DecodingText
					text={label}
					className="text-sm text-[var(--chat-text-subtle)]"
				/>
			) : null}
		</div>
	);
}

/** Used when the host supplies no mark: a filled dot, not a spinner. */
function FallbackMark() {
	return (
		<span
			style={{
				width: 7,
				height: 7,
				borderRadius: "50%",
				background: "color-mix(in srgb, var(--chat-text) 55%, transparent)",
			}}
		/>
	);
}
