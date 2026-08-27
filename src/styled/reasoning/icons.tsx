/**
 * Marks for the reasoning stream.
 *
 * Two levels, and only two. STEPS carry a mark so the left edge reads as one
 * consistent column; CHIPS carry one only when the tool changed something. An
 * icon on every chip turned a row of three tool calls into a row of three
 * competing glyphs and said nothing, since almost every call is a read.
 *
 * Drawn at 12-13px, where stroke detail disappears, so the solid marks are
 * filled silhouettes rather than line art.
 */

interface MarkProps {
	size?: number;
}

const box = (size: number) => ({
	width: size,
	height: size,
	viewBox: "0 0 24 24",
	"aria-hidden": true,
	style: { flexShrink: 0, display: "block" },
});

/**
 * A STEP the agent reasoned through. Three lines of decreasing width — a note,
 * not a bullet. Quiet enough to sit beside prose without competing with it, and
 * specific enough that the gutter reads as a deliberate column rather than an
 * indent.
 */
export function StepMark({ size = 13 }: MarkProps) {
	return (
		<svg {...box(size)} fill="currentColor">
			<rect x="3" y="6" width="18" height="2.1" rx="1.05" />
			<rect x="3" y="11" width="13.5" height="2.1" rx="1.05" />
			<rect x="3" y="16" width="8" height="2.1" rx="1.05" />
		</svg>
	);
}

/**
 * A WRITE: the agent changed something on a live account.
 *
 * A pencil, because that is the mark Google Ads and Meta Ads Manager both use
 * for editing a campaign — this audience already reads it as "this modified
 * something", with no translation. It is the ONLY mark a chip ever carries, so
 * a single change stands out in a paragraph full of reads.
 */
export function WriteMark({ size = 12 }: MarkProps) {
	return (
		<svg {...box(size)} fill="currentColor">
			<path d="M3 17.4V21h3.6L17.2 10.4l-3.6-3.6L3 17.4Z" />
			<path d="M20.7 7.0a.95.95 0 0 0 0-1.35l-2.35-2.35a.95.95 0 0 0-1.35 0l-1.75 1.75 3.7 3.7 1.75-1.75Z" />
		</svg>
	);
}

/**
 * An AGENT: one specialist, as it appears in a dispatch's pip row.
 *
 * A robot head, drawn geometrically rather than cartoonishly — square-ish
 * proportions, tight eyes, no mouth. It stands for the colleague doing the
 * work, which is what a pip needs to say; the STEP that dispatched it keeps
 * `DispatchMark`, because a step is a delegation, not a robot.
 *
 * The eyes are knocked out of the head with `fill-rule="evenodd"` rather than
 * painted in a background colour: this package has no surface token, so a
 * filled counter-shape would be wrong on any host that is not white.
 */
export function AgentMark({ size = 13 }: MarkProps) {
	return (
		<svg {...box(size)} fill="currentColor">
			{/* Antenna: stem plus a bead, drawn separately so the head's evenodd
			    knockout cannot punch a hole in it. */}
			<path d="M11.2 4.4h1.6v3.1h-1.6z" />
			<path d="M10.5 3.2a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0z" />
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M7.5 7h9a4 4 0 0 1 4 4v4.5a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4zM7.25 13.2a1.65 1.65 0 1 0 3.3 0 1.65 1.65 0 1 0-3.3 0zM13.45 13.2a1.65 1.65 0 1 0 3.3 0 1.65 1.65 0 1 0-3.3 0z"
			/>
		</svg>
	);
}

/**
 * A DISPATCH: the STEP in which the agent handed work to specialists.
 *
 * One node branching into two — the shape of the delegation itself, not of the
 * colleague doing it. This marks a sub-agent step in the same gutter a
 * thought's mark sits in, which is what makes the two read as members of one
 * sequence. Who is doing the work is said by the pips (`AgentMark`), a level
 * down; the two glyphs answer different questions and both are needed.
 */
export function DispatchMark({ size = 13 }: MarkProps) {
	return (
		<svg {...box(size)} fill="none">
			<path
				d="M12 7.6v3.4M5.6 17V12.4h12.8V17"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="12" cy="4.6" r="3" fill="currentColor" />
			<circle cx="5.6" cy="19.4" r="3" fill="currentColor" />
			<circle cx="18.4" cy="19.4" r="3" fill="currentColor" />
		</svg>
	);
}

/** Disclosure chevron. Rotates 90° on open. */
export function Chevron({ size = 12 }: MarkProps) {
	return (
		<svg
			{...box(size)}
			fill="none"
			stroke="currentColor"
			strokeWidth={2.6}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M9.5 5.5 16 12l-6.5 6.5" />
		</svg>
	);
}

/**
 * Three bars reading as a level meter: "this is working right now".
 *
 * The one live affordance in the panel, shared by the run footer and by a
 * dispatched specialist so both say it the same way.
 *
 * Still, under reduced motion, it holds the stepped shape the animation passes
 * through, so the row keeps its in-progress reading without moving.
 */
export function ActivityMeter({
	reducedMotion = false,
	size = 10,
}: {
	reducedMotion?: boolean;
	size?: number;
}) {
	const still = [0.4, 1, 0.6];
	return (
		<span
			aria-hidden
			style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: size }}
		>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					style={{
						width: 1.5,
						height: reducedMotion ? size * still[i] : size,
						background: "currentColor",
						transformOrigin: "bottom",
						animation: reducedMotion
							? undefined
							: "mf-bars 0.95s cubic-bezier(.16,1,.3,1) infinite",
						animationDelay: reducedMotion ? undefined : `${i * 0.13}s`,
						display: "inline-block",
					}}
				/>
			))}
		</span>
	);
}
