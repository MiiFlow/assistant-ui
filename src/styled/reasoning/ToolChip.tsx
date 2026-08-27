import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";
import { injectBeamerKeyframes } from "../../utils/beamer";
import { EASE, MONO_STACK, formatDuration, ink } from "./atoms";
import { durationSeconds } from "./build-steps";
import { WriteMark } from "./icons";
import type { RunStepTool } from "./types";

/**
 * One tool call, inline in the flow of the thought that justified it.
 *
 * ## Two states, not three
 *
 * Only a declared WRITE is marked. Reads and undeclared tools share one quiet
 * treatment, because both are honestly described by "nothing notable happened
 * here" — and because a mark per category produced a row of competing glyphs
 * that said nothing. Every run that predates the `writes` declaration reaching
 * the wire has no declaration at all, so a distinct "unknown" mark would have
 * stamped a loud diamond on the entire history for a signal with no content.
 *
 * ## Why there is no border
 *
 * A 1px outline plus an internal divider made these read as broken form
 * controls at 12px. A soft fill with no edge is one shape instead of three,
 * which is what lets a paragraph carry four of them without looking like a
 * toolbar. The duration recedes inside the same shape rather than sitting in a
 * compartment of its own.
 */
export function ToolChip({ tool }: { tool: RunStepTool }) {
	const ref = useRef<HTMLSpanElement>(null);
	const reducedMotion = usePrefersReducedMotion();
	const [hover, setHover] = useState(false);
	useEffect(() => {
		injectBeamerKeyframes(ref.current);
	}, []);

	const isRunning = tool.status === "running" || tool.status === "pending";
	const isFailed = tool.status === "failed";
	const isWrite = tool.kind === "write";
	const seconds = durationSeconds(tool.startedAt, tool.endedAt);

	// One-shot acknowledgement the moment a WRITE lands. A change to a live
	// account is the one event in this panel worth a beat of its own; reads get
	// nothing, or the emphasis means nothing.
	const [committed, setCommitted] = useState(false);
	const wasRunning = useRef(isRunning);
	useEffect(() => {
		const justLanded = wasRunning.current && !isRunning;
		wasRunning.current = isRunning;
		if (!justLanded || !isWrite || isFailed || reducedMotion) return;
		setCommitted(true);
		const id = setTimeout(() => setCommitted(false), 820);
		return () => clearTimeout(id);
	}, [isRunning, isWrite, isFailed, reducedMotion]);

	const tone = isFailed
		? {
				fill: "color-mix(in srgb, var(--chat-error) 8%, transparent)",
				label: "color-mix(in srgb, var(--chat-error) 82%, var(--chat-text))",
				figure: "color-mix(in srgb, var(--chat-error) 55%, transparent)",
				weight: 500,
			}
		: isWrite
			? {
					fill: ink(hover ? 13 : 10),
					label: ink(94),
					figure: ink(48),
					weight: 580,
				}
			: {
					fill: ink(hover ? 8 : 5),
					label: ink(66),
					figure: ink(34),
					weight: 450,
				};

	return (
		<span
			ref={ref}
			title={tool.name}
			className="mf-chip"
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{
				position: "relative",
				display: "inline-flex",
				alignItems: "center",
				gap: isWrite ? 6 : 0,
				// `baseline` would hang the chip off the text baseline and leave a
				// line of prose with chips in it visibly ragged; a small negative
				// offset centres it on the x-height instead.
				verticalAlign: "-0.22em",
				maxWidth: "100%",
				minWidth: 0,
				padding: "3px 9px",
				borderRadius: 6,
				background: tone.fill,
				// A 1px rise on hover. Small enough that a paragraph of chips does
				// not ripple as the pointer crosses it, big enough that they read as
				// things you can point at rather than as printed labels.
				transform: hover && !reducedMotion ? "translateY(-1px)" : undefined,
				transition: reducedMotion
					? undefined
					: `background 180ms ${EASE}, transform 180ms ${EASE}`,
				animation: reducedMotion ? undefined : `mf-chip-in 240ms ${EASE} both`,
			}}
		>
			{/* Commit pulse: one expanding ring that dissipates. Painted behind
			    the chip and non-interactive, so it cannot shift layout. */}
			{committed && (
				<span
					aria-hidden
					style={{
						position: "absolute",
						inset: -2,
						borderRadius: 8,
						animation: `mf-commit 820ms ${EASE} forwards`,
						pointerEvents: "none",
					}}
				/>
			)}

			{isWrite && (
				<span aria-hidden style={{ display: "inline-flex", color: ink(88) }}>
					<WriteMark size={12} />
				</span>
			)}

			<span
				style={{
					// A raw slug renders in mono so `render_table` reads as an
					// identifier rather than as malformed prose.
					fontFamily: tool.isSlugOnly ? MONO_STACK : undefined,
					fontVariantLigatures: tool.isSlugOnly ? "none" : undefined,
					fontSize: tool.isSlugOnly ? 11.5 : 12.5,
					lineHeight: 1.45,
					letterSpacing: "-0.004em",
					fontWeight: tone.weight,
					color: tone.label,
					textDecoration: isFailed ? "line-through" : undefined,
					textDecorationThickness: isFailed ? "1px" : undefined,
					textDecorationColor: isFailed
						? "color-mix(in srgb, var(--chat-error) 45%, transparent)"
						: undefined,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					// Generous: these labels are whole sentences the model wrote, and
					// clipping them at 260px turned most of a row into ellipses.
					maxWidth: 420,
					transition: reducedMotion ? undefined : `color 180ms ${EASE}`,
				}}
			>
				{tool.label}
			</span>

			{isRunning ? (
				<span
					aria-hidden
					style={{
						marginLeft: 7,
						width: 2,
						height: 10,
						borderRadius: 1,
						background: ink(52),
						animation: reducedMotion ? undefined : `mf-caret 1.05s ${EASE} infinite`,
						opacity: reducedMotion ? 0.6 : undefined,
						flexShrink: 0,
					}}
				/>
			) : (
				seconds !== undefined && (
					<span
						style={{
							marginLeft: 8,
							fontFamily: MONO_STACK,
							fontVariantNumeric: "tabular-nums",
							fontVariantLigatures: "none",
							fontSize: 10.5,
							letterSpacing: "0.01em",
							color: tone.figure,
							flexShrink: 0,
							animation: reducedMotion ? undefined : `mf-figure-in 300ms ${EASE} both`,
						}}
					>
						{formatDuration(seconds)}
					</span>
				)
			)}
		</span>
	);
}
