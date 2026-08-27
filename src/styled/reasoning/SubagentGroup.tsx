import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";
import type { SubagentChunkData } from "../../types";
import { injectBeamerKeyframes } from "../../utils/beamer";
import { EASE, MONO_STACK, formatDuration, ink } from "./atoms";
import { humanizeHandle, SubagentBody } from "./SubagentBlock";
import { AgentMark, Chevron } from "./icons";

/** Pip geometry. The ring is drawn in SVG so it needs the box in numbers. */
const PIP = 22;

export interface SubagentGroupProps {
	/** One dispatch, or several gathered from the same parent step. */
	members: SubagentChunkData[];
}

/**
 * A dispatch: one specialist, or several that ran at once.
 *
 * `dispatch_assistant` is parallelizable, so a parent step can gather three
 * specialists that work simultaneously. Rendered as three stacked rows that
 * reads as three things that happened in sequence, which is the one fact the
 * layout should not get wrong. A pip row says "these ran together" in the space
 * of one line, and the ring around each pip says which are still going.
 *
 * The pips are deliberately identical. Nothing in the data distinguishes one
 * specialist from another at a glance — the handle is a user-editable slug with
 * no platform link, and initials spell out letters nobody reads. So the group
 * carries COUNT and STATUS, and the tab row underneath carries identity.
 */
export function SubagentGroup({ members }: SubagentGroupProps) {
	const ref = useRef<HTMLDivElement>(null);
	const reducedMotion = usePrefersReducedMotion();
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	// Which way the reader moved. The incoming panel enters from the side they
	// came from, so a tab row reads as a strip that slides rather than as three
	// unrelated panels that blink.
	const [direction, setDirection] = useState<1 | -1>(1);
	const selectTab = (i: number) => {
		setDirection(i >= active ? 1 : -1);
		setActive(i);
	};
	useEffect(() => {
		injectBeamerKeyframes(ref.current);
	}, []);

	// A member can disappear mid-run (a trace revision that drops one), which
	// would otherwise leave `active` pointing past the end.
	const index = Math.min(active, members.length - 1);
	const selected = members[index];
	const isGroup = members.length > 1;

	const running = members.filter((m) => m.status === "running").length;
	const failed = members.filter((m) => m.status === "failed").length;

	// The batch's wall clock is its slowest member, not the sum: they overlapped.
	const slowestMs = members.reduce((max, m) => Math.max(max, m.durationMs ?? 0), 0);

	const summary = (() => {
		if (running > 0) return running === members.length ? "Working" : `${running} still working`;
		if (failed > 0) return `${failed} failed`;
		if (!isGroup) {
			const calls = countCalls(members[0]);
			return calls > 0 ? `${calls} ${calls === 1 ? "call" : "calls"}` : "Done";
		}
		return "Done";
	})();

	const openTo = (i: number) => {
		selectTab(i);
		setOpen(true);
	};

	return (
		<div ref={ref} style={{ minWidth: 0, maxWidth: "100%" }}>
			<div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
				{isGroup ? (
					<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
						{members.map((m, i) => (
							<Pip
								key={m.subagentId || i}
								member={m}
								selected={open && i === index}
								reducedMotion={reducedMotion}
								onClick={() => (open && i === index ? setOpen(false) : openTo(i))}
							/>
						))}
					</span>
				) : null}

				<button
					type="button"
					className="mf-focus"
					onClick={() => (open ? setOpen(false) : openTo(index))}
					aria-expanded={open}
					style={{
						display: "inline-flex",
						alignItems: "baseline",
						flexWrap: "wrap",
						gap: 7,
						minWidth: 0,
						padding: "1px 6px 1px 0",
						border: "none",
						background: "transparent",
						cursor: "pointer",
						font: "inherit",
						textAlign: "left",
					}}
				>
					<span
						style={{
							fontSize: 14,
							fontWeight: 550,
							letterSpacing: "-0.006em",
							color: failed > 0 ? "var(--chat-error)" : ink(86),
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{isGroup
							? `${members.length} specialists`
							: humanizeHandle(members[0].subagentType)}
					</span>

					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 5,
							fontSize: 11.5,
							letterSpacing: "-0.002em",
							color: ink(40),
						}}
					>
						{summary}
						{slowestMs > 0 && (
							<>
								<Dot />
								<span
									style={{
										fontFamily: MONO_STACK,
										fontVariantNumeric: "tabular-nums",
										fontVariantLigatures: "none",
									}}
								>
									{formatDuration(slowestMs / 1000)}
								</span>
							</>
						)}
					</span>

					<span
						aria-hidden
						style={{
							display: "inline-flex",
							alignSelf: "center",
							color: ink(34),
							transform: open ? "rotate(90deg)" : "none",
							transition: reducedMotion ? undefined : `transform 240ms ${EASE}`,
						}}
					>
						<Chevron size={12} />
					</span>
				</button>
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateRows: open ? "1fr" : "0fr",
					opacity: open ? 1 : 0,
					transition: reducedMotion
						? undefined
						: `grid-template-rows 260ms ${EASE}, opacity 260ms ${EASE}`,
				}}
			>
				<div style={{ overflow: "hidden", minHeight: 0 }}>
					<div
						style={{
							// One hairline marks the nested work as the specialists'
							// rather than the parent's. A hairline and not a filled rule:
							// the transcript has no rails, and a heavy one here would
							// reintroduce them.
							margin: "7px 0 2px 0",
							paddingLeft: 13,
							borderLeft: `1px solid ${ink(9)}`,
						}}
					>
						{isGroup && (
							<TabRow
								members={members}
								activeIndex={index}
								reducedMotion={reducedMotion}
								onSelect={selectTab}
							/>
						)}

						{/* Keyed so switching tabs remounts the body: the outgoing
						    specialist's expanded rows must not bleed into the incoming
						    one, and the remount is what re-runs the entrance. */}
						<div
							key={selected.subagentId || index}
							style={{
								animation:
									isGroup && !reducedMotion
										? `${direction === 1 ? "mf-panel-in-right" : "mf-panel-in-left"} 240ms ${EASE} both`
										: undefined,
							}}
						>
							<SubagentBody data={selected} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * The tab strip, with an indicator that travels between tabs.
 *
 * The bar is one element that moves, not a border that appears under whichever
 * tab is active. That difference is the whole point: a bar sliding from
 * "Google Ads" to "Microsoft Ads" says the two are positions in one strip,
 * where an indicator that blinks out and in says they are separate things.
 *
 * It moves on `transform` alone — a 1px-wide bar scaled to the tab's measured
 * width — so nothing on the row reflows while it travels.
 */
function TabRow({
	members,
	activeIndex,
	reducedMotion,
	onSelect,
}: {
	members: SubagentChunkData[];
	activeIndex: number;
	reducedMotion: boolean;
	onSelect: (index: number) => void;
}) {
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const [bar, setBar] = useState<{ x: number; w: number } | null>(null);

	// Layout effect, not effect: the bar must be in place on the frame the tab
	// row first paints, or it visibly slides in from x=0 on mount.
	useLayoutEffect(() => {
		const el = tabRefs.current[activeIndex];
		if (!el) return;
		setBar({ x: el.offsetLeft, w: el.offsetWidth });
	}, [activeIndex, members.length]);

	return (
		<div
			role="tablist"
			style={{
				position: "relative",
				display: "flex",
				flexWrap: "wrap",
				gap: 14,
				marginBottom: 9,
				paddingBottom: 6,
			}}
		>
			{members.map((m, i) => {
				const isActive = i === activeIndex;
				return (
					<button
						key={m.subagentId || i}
						ref={(el) => {
							tabRefs.current[i] = el;
						}}
						type="button"
						role="tab"
						aria-selected={isActive}
						className="mf-focus"
						onClick={() => onSelect(i)}
						style={{
							padding: 0,
							border: "none",
							background: "transparent",
							cursor: "pointer",
							font: "inherit",
							fontSize: 12.5,
							letterSpacing: "-0.004em",
							// Weight is fixed across states: bolding the active tab
							// re-measures the row, and the indicator would then chase a
							// target that moved while it was travelling.
							fontWeight: 520,
							color:
								m.status === "failed"
									? "var(--chat-error)"
									: isActive
										? ink(88)
										: ink(44),
							transition: reducedMotion ? undefined : `color 200ms ${EASE}`,
						}}
					>
						{humanizeHandle(m.subagentType)}
					</button>
				);
			})}

			{bar && (
				<span
					aria-hidden
					style={{
						position: "absolute",
						left: 0,
						bottom: 0,
						width: 1,
						height: 1.5,
						borderRadius: 1,
						background: ink(72),
						transformOrigin: "left center",
						transform: `translateX(${bar.x}px) scaleX(${bar.w})`,
						transition: reducedMotion
							? undefined
							: `transform 300ms ${EASE}`,
					}}
				/>
			)}
		</div>
	);
}

/** Total tool calls a specialist made, for the single-dispatch summary. */
function countCalls(data: SubagentChunkData): number {
	return (data.nestedChunks ?? []).filter((c) => c.type === "tool").length;
}

/**
 * One specialist in the group.
 *
 * Status lives in the RING, not in a fill: a solid hairline once it is done, a
 * short arc travelling the perimeter while it works. The arc is an SVG dash
 * rather than a conic-gradient border because a gradient ring needs to know the
 * surface colour behind it to mask its centre, and this package has no surface
 * token — a dash composites correctly over anything the host renders.
 */
function Pip({
	member,
	selected,
	reducedMotion,
	onClick,
}: {
	member: SubagentChunkData;
	selected: boolean;
	reducedMotion: boolean;
	onClick: () => void;
}) {
	const [hover, setHover] = useState(false);
	const label = humanizeHandle(member.subagentType);
	const isRunning = member.status === "running";
	const isFailed = member.status === "failed";
	const stroke = isFailed
		? "color-mix(in srgb, var(--chat-error) 70%, transparent)"
		: isRunning
			? ink(58)
			: ink(30);

	return (
		<span style={{ position: "relative", display: "inline-flex" }}>
			<button
				type="button"
				className="mf-focus"
				onClick={onClick}
				onMouseEnter={() => setHover(true)}
				onMouseLeave={() => setHover(false)}
				onFocus={() => setHover(true)}
				onBlur={() => setHover(false)}
				aria-label={label}
				style={{
					position: "relative",
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: PIP,
					height: PIP,
					padding: 0,
					border: "none",
					borderRadius: 7,
					background: selected ? ink(9) : hover ? ink(5) : "transparent",
					cursor: "pointer",
					color: isFailed ? "var(--chat-error)" : ink(isRunning ? 62 : 44),
					transition: reducedMotion ? undefined : `background 180ms ${EASE}`,
				}}
			>
				<svg
					aria-hidden
					width={PIP}
					height={PIP}
					viewBox={`0 0 ${PIP} ${PIP}`}
					fill="none"
					style={{ position: "absolute", inset: 0 }}
				>
					{/* Base ring, always drawn. Without it the running pip is only its
					    travelling dash — about a fifth of the perimeter at any instant —
					    so it read as a pip that had lost its border rather than one that
					    was busy. The beam rides on top of this. */}
					<rect
						x="0.75"
						y="0.75"
						width={PIP - 1.5}
						height={PIP - 1.5}
						rx="6.25"
						stroke={isRunning ? ink(14) : stroke}
						strokeWidth="1.5"
					/>
					{isRunning && (
						<rect
							x="0.75"
							y="0.75"
							width={PIP - 1.5}
							height={PIP - 1.5}
							rx="6.25"
							stroke={stroke}
							strokeWidth="1.5"
							strokeLinecap="round"
							// Perimeter ≈ 4·(22−1.5−2·6.25) + 2π·6.25 ≈ 71.
							strokeDasharray="17 54"
							style={
								reducedMotion
									? undefined
									: { animation: `mf-ring-travel 1.5s linear infinite` }
							}
						/>
					)}
				</svg>
				<AgentMark size={12} />
			</button>

			{hover && <PipCard member={member} label={label} reducedMotion={reducedMotion} />}
		</span>
	);
}

/**
 * What a pip cannot say on its own: which specialist it is.
 *
 * The pips are identical by design — nothing in the data distinguishes one from
 * another at a glance — so the name has to be one hover away rather than one
 * click away. It replaced a native `title`, which takes about a second to
 * appear, renders unstyled, and cannot hold a second line.
 */
function PipCard({
	member,
	label,
	reducedMotion,
}: {
	member: SubagentChunkData;
	label: string;
	reducedMotion: boolean;
}) {
	const calls = countCalls(member);
	const meta = [
		member.status === "running" ? "Working" : member.status === "failed" ? "Failed" : "Done",
		calls > 0 ? `${calls} ${calls === 1 ? "call" : "calls"}` : null,
		member.durationMs && member.durationMs > 0 ? formatDuration(member.durationMs / 1000) : null,
	].filter(Boolean) as string[];

	return (
		<span
			role="tooltip"
			style={{
				position: "absolute",
				top: "calc(100% + 7px)",
				// Anchored to the pip's LEFT edge, not centred on it. Pips sit at
				// the left of the content column, so a centred card on the first
				// one hangs into the gutter and gets clipped by the transcript's
				// horizontal bounds; growing rightwards there is always room for.
				left: -3,
				zIndex: 20,
				// The card must not swallow the pointer: leaving the pip to reach the
				// card would close it, and the card has nothing to click anyway.
				pointerEvents: "none",
				display: "flex",
				flexDirection: "column",
				gap: 2,
				// `max-content` is load-bearing. The card is absolutely positioned
				// inside the pip's 22px relative wrapper, so its containing block is
				// 22px wide and shrink-to-fit wrapped "Google Ads Specialist" onto
				// two lines regardless of any max-width.
				width: "max-content",
				// The transcript root is `overflow: hidden`, so anything that leaves
				// the message column is cut rather than layered over. The card grows
				// rightwards from the pip, and a very long handle wraps here rather
				// than running off the edge.
				maxWidth: 272,
				padding: "7px 10px",
				borderRadius: 7,
				// The fallback matters: a host that never sets this token would
				// otherwise resolve `var()` to nothing and render the card
				// transparent, with the transcript legible straight through it.
				background: "var(--chat-surface-raised, #ffffff)",
				boxShadow: `inset 0 0 0 1px ${ink(12)}, 0 6px 18px -8px color-mix(in srgb, var(--chat-text) 38%, transparent)`,
				animation: reducedMotion ? undefined : `mf-card-in 140ms ${EASE} both`,
			}}
		>
			<span
				style={{
					fontSize: 12.5,
					fontWeight: 580,
					letterSpacing: "-0.005em",
					lineHeight: 1.35,
					color: member.status === "failed" ? "var(--chat-error)" : ink(90),
				}}
			>
				{label}
			</span>
			<span
				style={{
					fontSize: 11,
					letterSpacing: "-0.002em",
					color: ink(48),
					whiteSpace: "nowrap",
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{meta.join(" · ")}
			</span>
		</span>
	);
}

function Dot() {
	return (
		<span
			aria-hidden
			style={{
				width: 2,
				height: 2,
				borderRadius: "50%",
				background: ink(26),
				display: "inline-block",
			}}
		/>
	);
}
