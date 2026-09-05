import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";
import { useScrollLock } from "../../hooks/use-scroll-lock";
import type { StreamingChunk } from "../../types";
import type { RunStep } from "./types";
import { injectBeamerKeyframes } from "../../utils/beamer";
import { cn } from "../../utils/cn";
import { EASE, MONO_STACK, formatDuration, formatElapsed, ink } from "./atoms";
import { buildRunSteps, stepsWallClockSeconds } from "./build-steps";
import { StepBlock } from "./StepBlock";
import { ActivityMeter, Chevron, DispatchMark, WriteMark } from "./icons";

/** Steps kept on screen during a live run. Older ones fade out above. */
const WINDOW_SIZE = 3;
/**
 * Opacity ramp for the window, oldest first; the last entry is the live step.
 *
 * The floor stays legible on purpose: when a run has exactly WINDOW_SIZE steps
 * nothing is hidden and no "Show all" toggle appears, so the faintest step is
 * still content the reader has to be able to read.
 */
const WINDOW_OPACITY = [0.45, 0.72, 1];
/** Gap between steps. Each one now carries a mark in its own gutter, so the
 *  column does the separating and the whitespace can come back down. */
const STEP_GAP = 9;
/** Stagger between steps when a finished trace is opened. Small on purpose:
 *  this is a disclosure the reader asked for, not a performance, and the whole
 *  reveal has to land well inside the time it takes to look down the list. */
const REVEAL_STAGGER_MS = 26;
const REVEAL_STAGGER_CAP_MS = 220;
/** How long the completion collapse runs. Also the scroll-lock duration. */
const COLLAPSE_MS = 280;

export interface ReasoningStreamProps {
	/** Whether the run is still producing steps. */
	isStreaming?: boolean;
	/** The turn's reasoning chunks, live or replayed from the durable trace. */
	chunks?: StreamingChunk[];
	/** The steps already built from `chunks`. `Message` builds them once to
	 *  decide whether there is anything to draw and hands them down so the same
	 *  list is not rebuilt here; omitted, they are built from `chunks`. */
	steps?: RunStep[];
	/** Persisted wall clock for the whole run, in seconds. */
	executionTime?: number;
	/**
	 * Epoch ms the in-progress run started. Supply the run's durable start so the
	 * live counter survives this component remounting — timing from mount
	 * restarts at 0 on a run that is already minutes old.
	 */
	streamStartedAt?: number;
	/**
	 * The run finished moments ago, in a DIFFERENT component instance.
	 *
	 * Needed only when the host renders the completed message as a separate
	 * element from the streaming one, so this instance never sees the
	 * streaming→complete edge. With a stable key the edge is observed here and
	 * the fold runs on its own; this prop then adds nothing.
	 */
	justCompleted?: boolean;
	/** Controlled disclosure of the finished turn's full trace. */
	expanded?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
	className?: string;
}

/** Live elapsed seconds, counted from the run's durable start where available. */
function useElapsed(isStreaming: boolean, startedAt?: number): number {
	const localStartRef = useRef<number | null>(null);
	const [seconds, setSeconds] = useState(0);

	if (isStreaming && localStartRef.current === null) localStartRef.current = Date.now();
	if (!isStreaming) localStartRef.current = null;

	const start = startedAt && startedAt > 0 ? startedAt : localStartRef.current;

	useEffect(() => {
		if (!isStreaming || start === null) return;
		// Clamp: a durable start comes from the server, so a client clock running
		// behind it must not render a negative figure.
		const tick = () => setSeconds(Math.max(0, (Date.now() - start) / 1000));
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [isStreaming, start]);

	return seconds;
}

/**
 * The agent's work, rendered as steps in the transcript.
 *
 * Live, it is a rolling window of the last few steps — the newest at full
 * strength, older ones fading out above. A long run therefore costs a fixed
 * amount of vertical space instead of pushing the composer off the screen.
 *
 * Finished, it collapses to one line: `Thought for 2:14 · 6 steps`, which
 * re-opens to the full trace on click.
 */
export function ReasoningStream({
	isStreaming = false,
	chunks,
	steps: stepsProp,
	executionTime,
	streamStartedAt,
	justCompleted = false,
	expanded: controlledExpanded,
	onExpandedChange,
	className,
}: ReasoningStreamProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const reducedMotion = usePrefersReducedMotion();
	useEffect(() => {
		injectBeamerKeyframes(containerRef.current);
	}, []);

	const steps = useMemo(
		() => stepsProp ?? buildRunSteps(chunks, isStreaming),
		[stepsProp, chunks, isStreaming],
	);
	const elapsed = useElapsed(isStreaming, streamStartedAt);

	// Expanding a LIVE run turns the step list into its own scroll box, and new
	// steps land at the bottom of it — outside the visible area, where the outer
	// transcript's auto-scroll cannot reach them. Follow the newest step here,
	// but only while the reader is already at the bottom: someone who scrolled
	// up to re-read an earlier step must not be yanked back down.
	// Highest step count this instance has rendered. Steps at or below it were
	// already on screen, so only what arrives ABOVE it animates in — a replayed
	// trace, and a re-opened one, must not perform an entrance for work that
	// finished minutes ago.
	const seenStepsRef = useRef(0);
	const liveScrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = liveScrollRef.current;
		if (!el) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (distanceFromBottom > 48) return;
		el.scrollTop = el.scrollHeight;
	}, [steps.length]);

	// One disclosure flag for both phases: "show all steps" during the run and
	// "the trace is open" after it. Sharing them is what lets a trace the user
	// deliberately opened mid-run stay open once the answer lands, instead of
	// slamming shut on them at the moment they were reading it.
	const [localExpanded, setLocalExpanded] = useState(false);
	const lockScroll = useScrollLock(containerRef, COLLAPSE_MS);

	const isExpanded = controlledExpanded ?? localExpanded;
	const setExpanded = useCallback(
		(value: boolean) => {
			lockScroll();
			setLocalExpanded(value);
			onExpandedChange?.(value);
		},
		[lockScroll, onExpandedChange],
	);

	// The collapse animation.
	//
	// The fold needs the trace painted once at full height and then flipped to
	// zero on the next frame, so the browser has two states to interpolate
	// between. Two rAFs because a single one can still run before the first
	// paint. It is requested from two places:
	//
	// - the streaming→complete edge observed on THIS instance, which is what a
	//   host with stable message keys produces (`useMiiflowChat` since 0.17);
	// - `justCompleted`, from a host that still remounts the completed message,
	//   where the edge is invisible from in here and arrives on a fresh mount.
	//
	// The edge is derived during render — state set from a prop comparison,
	// React's documented "adjust state when a prop changes" pattern — rather
	// than in an effect: an effect runs after commit, and the frame it would
	// fix (the trace already snapped shut) has been painted by then.
	//
	// A fold is a one-shot REQUEST, counted, not a standing condition: the
	// reader collapsing a finished trace by hand must get the plain CSS
	// transition, not a replay of the completion fold. Nothing to fold when
	// the trace is open, and reduced motion lands on the summary directly.
	const foldOnMount = justCompleted && !reducedMotion && !isExpanded;
	const [foldRequest, setFoldRequest] = useState(foldOnMount ? 1 : 0);
	const [phase, setPhase] = useState<"idle" | "open" | "closing">(
		foldOnMount ? "open" : "idle",
	);
	const [prevStreaming, setPrevStreaming] = useState(isStreaming);
	const [prevJustCompleted, setPrevJustCompleted] = useState(justCompleted);
	if (prevStreaming !== isStreaming || prevJustCompleted !== justCompleted) {
		const edge =
			(prevStreaming && !isStreaming) || (!prevJustCompleted && justCompleted);
		setPrevStreaming(isStreaming);
		setPrevJustCompleted(justCompleted);
		if (edge && !reducedMotion && !isExpanded) {
			setFoldRequest((n) => n + 1);
			setPhase("open");
		}
	}
	useEffect(() => {
		if (foldRequest === 0) return;
		setPhase("open");
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => setPhase("closing"));
		});
		const done = setTimeout(() => setPhase("idle"), COLLAPSE_MS + 48);
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
			clearTimeout(done);
		};
	}, [foldRequest]);

	// Commit after the render that used it: the value read above must be the
	// count from the PREVIOUS pass, or every step would look already-seen.
	const previouslySeen = seenStepsRef.current;
	seenStepsRef.current = Math.max(seenStepsRef.current, steps.length);

	if (steps.length === 0) return null;

	const totalSeconds =
		executionTime && executionTime > 0 ? executionTime : stepsWallClockSeconds(steps);

	// What the collapsed line reports. Changes and specialists are called out by
	// name because they are the two things worth re-opening a finished trace
	// for; a plain step count answers neither.
	const allTools = steps.flatMap((step) => step.tools);
	// A write that FAILED changed nothing, so it is not counted as a change —
	// "1 change · 1 failed" on a single rejected budget update says two
	// contradictory things about the same event.
	const writeCount = allTools.filter((t) => t.kind === "write" && t.status !== "failed").length;
	const agentCount = steps.filter((step) => step.kind === "subagent").length;
	const failedCount = allTools.filter((t) => t.status === "failed").length;

	// ---------------------------------------------------------------- streaming
	if (isStreaming) {
		const windowed = isExpanded ? steps : steps.slice(-WINDOW_SIZE);
		const hiddenCount = steps.length - windowed.length;
		// Fade only applies to the rolling window; the full list is a document.
		const opacityFor = (index: number) => {
			if (isExpanded) return 1;
			const fromEnd = windowed.length - 1 - index;
			return WINDOW_OPACITY[Math.max(0, WINDOW_OPACITY.length - 1 - fromEnd)] ?? 1;
		};

		return (
			<div ref={containerRef} className={cn("max-w-full", className)}>
				<div
					ref={liveScrollRef}
					style={{
						position: "relative",
						display: "flex",
						flexDirection: "column",
						gap: STEP_GAP,
						...(isExpanded
							? {}
							: hiddenCount > 0
								? {
										// Dissolve the outgoing step into the top edge
										// rather than clipping it on a hard line.
										maskImage: "linear-gradient(to bottom, transparent 0%, black 26%)",
										WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 26%)",
									}
								: {}),
					}}
				>
					{windowed.map((step, index) => (
						<div
							key={step.id}
							style={{
								opacity: opacityFor(index),
								transition: reducedMotion ? undefined : `opacity 520ms ${EASE}`,
							}}
						>
							<StepBlock
								step={step}
								dimmed={!isExpanded && opacityFor(index) < 1}
								entering={isStreaming && step.sequence >= previouslySeen}
							/>
						</div>
					))}
				</div>

				<LiveFooter
					elapsed={elapsed}
					totalSteps={steps.length}
					showingAll={isExpanded}
					canToggle={steps.length > WINDOW_SIZE}
					reducedMotion={reducedMotion}
					onToggle={() => {
						setExpanded(!isExpanded);
					}}
				/>
			</div>
		);
	}

	// ---------------------------------------------------------------- completed
	const bodyOpen = isExpanded || phase === "open";
	const revealing = isExpanded && phase === "idle";

	return (
		<div ref={containerRef} className={cn("max-w-full", className)}>
			<SummaryLine
				seconds={totalSeconds}
				stepCount={steps.length}
				writeCount={writeCount}
				agentCount={agentCount}
				failedCount={failedCount}
				open={isExpanded}
				reducedMotion={reducedMotion}
				onToggle={() => setExpanded(!isExpanded)}
			/>

			<div
				style={{
					display: "grid",
					// Animating grid-template-rows between 0fr and 1fr collapses
					// content of unknown height without measuring it — a fixed
					// max-height would either clip a long trace or animate through
					// empty space on a short one.
					gridTemplateRows: bodyOpen ? "1fr" : "0fr",
					opacity: bodyOpen ? 1 : 0,
					transition: reducedMotion
						? undefined
						: `grid-template-rows ${COLLAPSE_MS}ms ${EASE}, opacity ${COLLAPSE_MS}ms ${EASE}`,
				}}
			>
				<div style={{ overflow: "hidden", minHeight: 0 }}>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: STEP_GAP,
							paddingTop: 9,
						}}
					>
						{steps.map((step, i) => (
							<StepBlock
								key={step.id}
								step={step}
								// Stagger only when the READER opened this. During the
								// auto-collapse the body is mounted open purely so it has
								// somewhere to fold from, and steps animating in while it
								// folds away is two motions fighting.
								entering={revealing}
								enterDelayMs={Math.min(i * REVEAL_STAGGER_MS, REVEAL_STAGGER_CAP_MS)}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * The collapsed line for a finished turn.
 *
 * "Thought for 2:14 · 6 steps" is honest but tells a marketer nothing they act
 * on. What they want to know before deciding whether to open it is whether the
 * agent CHANGED anything, and whether it pulled in a specialist. So changes are
 * counted separately, in the same warning tint the chips use, and the plain
 * step count is demoted to the quiet half of the line.
 *
 * The duration is the only figure set in mono: it is the one value a reader
 * compares between turns, and tabular digits stop it jittering as it changes.
 */
function SummaryLine({
	seconds,
	stepCount,
	writeCount,
	agentCount,
	failedCount,
	open,
	reducedMotion,
	onToggle,
}: {
	seconds?: number;
	stepCount: number;
	writeCount: number;
	agentCount: number;
	failedCount: number;
	open: boolean;
	reducedMotion: boolean;
	onToggle: () => void;
}) {
	const [hover, setHover] = useState(false);

	return (
		<button
			type="button"
			className="mf-focus"
			onClick={onToggle}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			aria-expanded={open}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 7,
				padding: "4px 9px 4px 8px",
				marginLeft: -8,
				borderRadius: 6,
				background: hover ? ink(4) : "transparent",
				border: "none",
				cursor: "pointer",
				font: "inherit",
				fontSize: 12.5,
				letterSpacing: "-0.004em",
				transition: reducedMotion ? undefined : `background 180ms ${EASE}`,
			}}
		>
			<span style={{ color: ink(hover ? 76 : 62), fontWeight: 500 }}>
				{seconds !== undefined && seconds > 0 ? (
					<>
						Thought for{" "}
						<span
							style={{
								fontFamily: MONO_STACK,
								fontVariantNumeric: "tabular-nums",
								fontVariantLigatures: "none",
								fontWeight: 600,
							}}
						>
							{formatDuration(seconds)}
						</span>
					</>
				) : (
					"Reasoning"
				)}
			</span>

			{writeCount > 0 && (
				<>
					<Dot />
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
							fontWeight: 600,
							color: ink(92),
						}}
					>
						<span aria-hidden style={{ display: "inline-flex", color: ink(80) }}>
							<WriteMark size={11.5} />
						</span>
						{writeCount} {writeCount === 1 ? "change" : "changes"}
					</span>
				</>
			)}

			{agentCount > 0 && (
				<>
					<Dot />
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
							color: ink(58),
							fontWeight: 500,
						}}
					>
						<span aria-hidden style={{ display: "inline-flex", color: ink(45) }}>
							<DispatchMark size={11.5} />
						</span>
						{agentCount}
					</span>
				</>
			)}

			{failedCount > 0 && (
				<>
					<Dot />
					<span style={{ color: "var(--chat-error)", fontWeight: 560 }}>
						{failedCount} failed
					</span>
				</>
			)}

			<Dot />
			<span style={{ color: ink(42), fontWeight: 400 }}>
				{stepCount} {stepCount === 1 ? "step" : "steps"}
			</span>

			<span
				aria-hidden
				style={{
					display: "inline-flex",
					color: ink(hover ? 52 : 34),
					marginLeft: 1,
					transform: open ? "rotate(90deg)" : "none",
					transition: reducedMotion ? undefined : `transform 240ms ${EASE}, color 180ms ${EASE}`,
				}}
			>
				<Chevron size={11} />
			</span>
		</button>
	);
}

/** Live status line: what is happening, for how long, and a way to see it all. */
function LiveFooter({
	elapsed,
	totalSteps,
	showingAll,
	canToggle,
	reducedMotion,
	onToggle,
}: {
	elapsed: number;
	totalSteps: number;
	showingAll: boolean;
	canToggle: boolean;
	reducedMotion: boolean;
	onToggle: () => void;
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				marginTop: 8,
				fontSize: 11.5,
				color: ink(42),
			}}
		>
			<span style={{ display: "inline-flex", color: ink(52) }}>
				<ActivityMeter reducedMotion={reducedMotion} />
			</span>
			{elapsed >= 1 && (
				<span
					style={{
						fontFamily: MONO_STACK,
						fontVariantNumeric: "tabular-nums",
						fontVariantLigatures: "none",
						fontSize: 11,
						fontWeight: 600,
						letterSpacing: "0.02em",
						color: ink(72),
					}}
				>
					{formatElapsed(elapsed)}
				</span>
			)}
			{canToggle && (
				<button
					type="button"
					className="mf-focus"
					onClick={onToggle}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 3,
						background: "transparent",
						border: "none",
						padding: 0,
						cursor: "pointer",
						font: "inherit",
						fontSize: 11.5,
						color: ink(42),
					}}
				>
					{showingAll ? "Show less" : `Show all ${totalSteps} steps`}
					<span
						aria-hidden
						style={{
							display: "inline-flex",
							transform: showingAll ? "rotate(90deg)" : "none",
							transition: reducedMotion ? undefined : `transform 240ms ${EASE}`,
						}}
					>
						<Chevron size={11} />
					</span>
				</button>
			)}
		</div>
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
				background: ink(28),
				display: "inline-block",
			}}
		/>
	);
}
