import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";
import { injectBeamerKeyframes } from "../../utils/beamer";
import { MarkdownContent } from "../MarkdownContent";
import { EASE, TEXT_SHIMMER_STYLE, ink } from "./atoms";
import { DispatchMark, StepMark } from "./icons";
import { SubagentGroup } from "./SubagentGroup";
import { ToolChip } from "./ToolChip";
import type { RunStep } from "./types";

/** Width of the mark column. Every step reserves it, so prose starts on one x. */
const GUTTER = 22;

export interface StepBlockProps {
	step: RunStep;
	/** Older step in the live window: quieter, and never the shimmering one. */
	dimmed?: boolean;
	/** Animate an entrance. False for steps already on screen (a replayed
	 *  trace must not perform, and re-opening one must not re-animate). */
	entering?: boolean;
	/** Delay in ms, for staggering a revealed trace. */
	enterDelayMs?: number;
}

/**
 * One step of the transcript: a mark, then prose, with the tool calls it
 * justified flowing inline underneath.
 *
 * Every step type sits in the same two-column shape — mark gutter, content —
 * so a thought and a dispatched specialist read as members of one sequence.
 * The specialist used to wear a 24px initials badge instead, which made it a
 * different kind of object on the page and spelled out "GA" to no one's
 * benefit.
 *
 * There is deliberately no rule connecting the marks. A rail would turn this
 * back into the trace viewer the redesign replaced; the shared x-position is
 * enough to read as a column.
 */
export function StepBlock({
	step,
	dimmed = false,
	entering = false,
	enterDelayMs = 0,
}: StepBlockProps) {
	const ref = useRef<HTMLDivElement>(null);
	const reducedMotion = usePrefersReducedMotion();
	useEffect(() => {
		injectBeamerKeyframes(ref.current);
	}, []);

	const isSubagent = step.kind === "subagent";
	const isRunning = step.status === "running";
	const hasText = !!step.text && step.text.trim().length > 0;
	// The shimmer is an inline `animation`, which a reduced-motion media query
	// cannot override — so it is simply not applied.
	const shimmer = isRunning && !dimmed && !reducedMotion;

	if (isSubagent && step.subagents.length === 0) return null;

	return (
		<div
			ref={ref}
			className="mf-step"
			style={{
				display: "grid",
				gridTemplateColumns: `${GUTTER}px minmax(0, 1fr)`,
				alignItems: "start",
				minWidth: 0,
				maxWidth: "100%",
				animation:
					entering && !reducedMotion
						? `mf-step-in 340ms ${EASE} ${enterDelayMs}ms both`
						: undefined,
			}}
		>
			<span
				aria-hidden
				style={{
					display: "inline-flex",
					alignItems: "center",
					// Optical centring on the first line of 14px/1.62 prose. A
					// flex-start icon sits visibly high against a cap-height.
					height: 22,
					color: ink(isSubagent ? 46 : dimmed ? 24 : 34),
					transition: reducedMotion ? undefined : `color 260ms ${EASE}`,
				}}
			>
				{isSubagent ? <DispatchMark size={13} /> : <StepMark size={13} />}
			</span>

			<div style={{ minWidth: 0 }}>
				{isSubagent ? (
					<SubagentGroup members={step.subagents} />
				) : (
					<>
						<div
							style={{
								// Metrics are FIXED across states on purpose. Making the
								// live step larger or heavier reads well in a screenshot
								// and badly in motion: every time a step stops being the
								// live one its text re-wraps and the window below jumps.
								// The hierarchy is carried by ink and by the shimmer.
								fontSize: 14,
								lineHeight: 1.62,
								letterSpacing: "-0.005em",
								fontWeight: 400,
								transition: reducedMotion ? undefined : `color 260ms ${EASE}`,
								...(shimmer ? TEXT_SHIMMER_STYLE : { color: ink(dimmed ? 52 : 80) }),
							}}
						>
							{hasText && <MarkdownContent className="text-[14px]">{step.text!}</MarkdownContent>}
						</div>

						{step.tools.length > 0 && (
							<div
								style={{
									marginTop: hasText ? 6 : 1,
									display: "flex",
									flexWrap: "wrap",
									alignItems: "center",
									// Chips are soft shapes with no edge, so they need real
									// air between them or two adjacent fills merge into one
									// blob. Row gap matches so a wrapped run breathes the
									// same amount in both directions.
									gap: 7,
									// Chips carry their own colour; the shimmer's transparent
									// text fill must not bleed into them.
									WebkitTextFillColor: "initial",
									color: "initial",
								}}
							>
								{step.tools.map((tool) => (
									<ToolChip key={tool.id} tool={tool} />
								))}
							</div>
						)}

						{step.tools
							.filter((tool) => tool.status === "failed" && tool.observationExcerpt)
							.map((tool) => (
								<div
									key={`${tool.id}-error`}
									style={{
										marginTop: 7,
										padding: "7px 10px",
										borderRadius: 6,
										fontSize: 12.5,
										lineHeight: 1.5,
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
										// Red survives only as type and hairlines, never as a
										// fill. It is the one hue left in this panel, and
										// confining it to the words keeps it a signal rather
										// than a wash.
										color: "color-mix(in srgb, var(--chat-error) 82%, var(--chat-text))",
										background: ink(3),
										boxShadow: `inset 0 0 0 1px ${ink(10)}`,
									}}
								>
									{tool.observationExcerpt}
								</div>
							))}
					</>
				)}
			</div>
		</div>
	);
}
