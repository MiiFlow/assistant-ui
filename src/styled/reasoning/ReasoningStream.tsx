import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";
import { useScrollLock } from "../../hooks/use-scroll-lock";
import type { StreamingChunk } from "../../types";
import type { RunStep } from "./types";
import { injectBeamerKeyframes } from "../../utils/beamer";
import { cn } from "../../utils/cn";
import { DecodingText } from "../ThinkingIndicator";
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
/** How long a fold runs. Also the scroll-lock duration. */
const COLLAPSE_MS = 280;
/** The header line's height, constant across every phase so the row above
 *  the answer never changes size as the run moves from waiting to working to
 *  done. */
const HEADER_MIN_HEIGHT = 26;

/**
 * Which face the panel shows.
 *
 * - `waiting`: the run has started and produced nothing yet — one status line.
 * - `live-open`: steps are arriving and the answer has not begun — the last
 *   few steps are on screen, newest at full strength.
 * - `live-collapsed`: the answer is streaming — the body is folded so nothing
 *   above the text changes height while it types; the header keeps counting.
 * - `done`: the run ended — one "Thought for …" line, re-openable.
 * - `hidden`: the answer is streaming and there was never a step. Nothing is
 *   drawn — the finished row will have nothing to draw either, and a header
 *   that showed here and vanished at completion would move the text.
 */
export type ReasoningPhase = "waiting" | "live-open" | "live-collapsed" | "done" | "hidden";

export function resolveReasoningPhase({
	isStreaming,
	answerStarted,
	stepCount,
}: {
	isStreaming: boolean;
	answerStarted: boolean;
	stepCount: number;
}): ReasoningPhase {
	if (!isStreaming) return "done";
	if (answerStarted) return stepCount === 0 ? "hidden" : "live-collapsed";
	if (stepCount === 0) return "waiting";
	return "live-open";
}

export interface ReasoningStreamProps {
	/** Whether the run is still producing steps. */
	isStreaming?: boolean;
	/** The answer body has begun. The host derives it from the message text;
	 *  from this moment the step list folds so it stops pushing the text. */
	answerStarted?: boolean;
	/** Status line for the pre-step window ("Getting started…"). */
	waitingLabel?: string | null;
	/** Brand mark for the pre-step window, supplied by the host. */
	waitingMark?: ReactNode;
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
	 * @deprecated Only needed by a host that remounts the completed message under
	 * a new key. With a stable key the streaming→complete edge is observed here
	 * and the fold runs on its own. Kept working for one minor; removed next major.
	 */
	justCompleted?: boolean;
	/** Controlled disclosure of the full trace. */
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
 * One layout for every phase: a header line of constant height, then a body
 * that is a CSS grid row animating between `0fr` and `1fr`. Live and before
 * the answer, the body is a rolling window of the last few steps — the newest
 * at full strength, older ones fading out above, so a long run costs a fixed
 * amount of vertical space. The moment the answer begins the body folds: from
 * then on nothing above the streaming text changes height. Finished, the
 * header reads `Thought for 2:14 · 6 steps` and re-opens to the full trace.
 */
export function ReasoningStream({
	isStreaming = false,
	answerStarted = false,
	waitingLabel,
	waitingMark,
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
	const phase = resolveReasoningPhase({ isStreaming, answerStarted, stepCount: steps.length });

	// Highest step count this instance has rendered. Steps at or below it were
	// already on screen, so only what arrives ABOVE it animates in — a replayed
	// trace, and a re-opened one, must not perform an entrance for work that
	// finished minutes ago.
	const seenStepsRef = useRef(0);

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

	// The fold.
	//
	// It needs the window painted once at full height and then flipped to zero
	// on the next frame, so the browser has two states to interpolate between.
	// Two rAFs because a single one can still run before the first paint. It is
	// requested on two edges, both derived during render (state set from a prop
	// comparison — React's "adjust state when a prop changes" pattern) rather
	// than in an effect, which would run after the snapped-shut frame painted:
	//
	// - `live-open` → `live-collapsed` or `done` observed on THIS instance;
	// - `justCompleted`, from a host that still remounts the completed message.
	//
	// What folds is the window that was on screen, captured at the request:
	// painting the full trace open for one frame — the previous behaviour — was
	// a height spike of the whole run's steps right above the answer.
	//
	// A fold is a one-shot REQUEST, counted, not a standing condition: the
	// reader collapsing a finished trace by hand gets the plain CSS transition,
	// not a replay of the completion fold. Nothing to fold when the trace is
	// open, and reduced motion lands on the summary directly.
	const foldOnMount = justCompleted && !reducedMotion && !isExpanded;
	const foldStepsRef = useRef<RunStep[]>(foldOnMount ? steps.slice(-WINDOW_SIZE) : []);
	const [foldRequest, setFoldRequest] = useState(foldOnMount ? 1 : 0);
	const [foldPhase, setFoldPhase] = useState<"idle" | "open" | "closing">(
		foldOnMount ? "open" : "idle",
	);
	// True when this instance observed the run finishing (or remounted right at
	// completion via justCompleted). Drives the summary line's one-shot
	// entrance — a trace replayed from history mounts already done and must
	// not perform it.
	const [enteredDone, setEnteredDone] = useState(justCompleted);
	const [prevPhase, setPrevPhase] = useState(phase);
	const [prevJustCompleted, setPrevJustCompleted] = useState(justCompleted);
	if (prevPhase !== phase || prevJustCompleted !== justCompleted) {
		const closingEdge =
			prevPhase === "live-open" && (phase === "live-collapsed" || phase === "done");
		const remountEdge = !prevJustCompleted && justCompleted;
		if (phase === "done" && prevPhase !== "done") setEnteredDone(true);
		setPrevPhase(phase);
		setPrevJustCompleted(justCompleted);
		if ((closingEdge || remountEdge) && !reducedMotion && !isExpanded) {
			foldStepsRef.current = steps.slice(-WINDOW_SIZE);
			setFoldRequest((n) => n + 1);
			setFoldPhase("open");
		}
	}
	useEffect(() => {
		if (foldRequest === 0) return;
		setFoldPhase("open");
		// Deliberately NOT scroll-locked. `useScrollLock` hides the scrollbar
		// for the duration, and a layout scrollbar vanishing changes the
		// column width and rewraps every line in the transcript — a bigger
		// shift than the fold. An anchored host reserves the fold's height in
		// the row (`MessageList`'s turn fill); a following host follows.
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => setFoldPhase("closing"));
		});
		const done = setTimeout(() => setFoldPhase("idle"), COLLAPSE_MS + 48);
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
			clearTimeout(done);
		};
	}, [foldRequest]);

	// Expanding a LIVE run turns the step list into its own scroll box, and new
	// steps land at the bottom of it. Follow the newest step here, but only
	// while the reader is already at the bottom: someone who scrolled up to
	// re-read an earlier step must not be yanked back down.
	const liveScrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = liveScrollRef.current;
		if (!el) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		if (distanceFromBottom > 48) return;
		el.scrollTop = el.scrollHeight;
	}, [steps.length]);

	// Commit after the render that used it: the value read above must be the
	// count from the PREVIOUS pass, or every step would look already-seen.
	const previouslySeen = seenStepsRef.current;
	seenStepsRef.current = Math.max(seenStepsRef.current, steps.length);

	if (steps.length === 0 && (!isStreaming || phase === "hidden")) return null;

	const totalSeconds =
		executionTime && executionTime > 0 ? executionTime : stepsWallClockSeconds(steps);

	// What the collapsed line reports. Changes and specialists are called out by
	// name because they are the two things worth re-opening a finished trace
	// for; a plain step count answers neither.
	const allTools = steps.flatMap((step) => step.tools);
	// A write that FAILED changed nothing, so it is not counted as a change —
	// "1 change · 1 failed" on a single rejected budget update says two
	// contradictory things about the same event.
	// An INTERRUPTED write is excluded for the same reason a failed one is, and
	// it is the more dangerous of the two: the run ended before the call closed,
	// so nobody knows whether the budget moved. Counting it as a change told the
	// reader "1 change" about something that may never have happened.
	const writeCount = allTools.filter(
		(t) => t.kind === "write" && t.status !== "failed" && t.status !== "interrupted",
	).length;
	const agentCount = steps.filter((step) => step.kind === "subagent").length;
	const failedCount = allTools.filter((t) => t.status === "failed").length;
	const interruptedCount = allTools.filter((t) => t.status === "interrupted").length;

	// ------------------------------------------------------------------ body
	const folding = foldPhase !== "idle" && !isExpanded;
	const windowed = phase === "live-open" && !isExpanded;
	const bodyOpen = isExpanded || windowed || foldPhase === "open";
	// Stagger only when the READER opened a finished trace. During the fold the
	// body is open purely so it has somewhere to fold from, and steps animating
	// in while it folds away is two motions fighting.
	const revealing = isExpanded && foldPhase === "idle" && phase === "done";

	let bodySteps: RunStep[];
	if (isExpanded) bodySteps = steps;
	else if (windowed) bodySteps = steps.slice(-WINDOW_SIZE);
	else if (folding) bodySteps = foldStepsRef.current;
	// Finished and closed: the trace stays in the DOM at zero height, so
	// re-opening it costs no re-render and the caret has something to reveal.
	else if (phase === "done") bodySteps = steps;
	else bodySteps = [];

	const hiddenCount = windowed ? steps.length - bodySteps.length : 0;
	// Fade only applies to the rolling window; the full list is a document.
	const opacityFor = (index: number) => {
		if (!windowed) return 1;
		const fromEnd = bodySteps.length - 1 - index;
		return WINDOW_OPACITY[Math.max(0, WINDOW_OPACITY.length - 1 - fromEnd)] ?? 1;
	};

	const canToggle =
		phase === "live-collapsed" ? steps.length > 0 : steps.length > WINDOW_SIZE;

	return (
		<div ref={containerRef} className={cn("max-w-full", className)}>
			{phase === "waiting" ? (
				<WaitingLine label={waitingLabel} mark={waitingMark} elapsed={elapsed} reducedMotion={reducedMotion} />
			) : phase === "done" ? (
				<SummaryLine
					seconds={totalSeconds}
					stepCount={steps.length}
					writeCount={writeCount}
					agentCount={agentCount}
					failedCount={failedCount}
					interruptedCount={interruptedCount}
					open={isExpanded}
					reducedMotion={reducedMotion}
					entering={enteredDone && !reducedMotion}
					onToggle={() => setExpanded(!isExpanded)}
				/>
			) : (
				<LiveLine
					elapsed={elapsed}
					totalSteps={steps.length}
					showingAll={isExpanded}
					collapsed={phase === "live-collapsed"}
					canToggle={canToggle}
					reducedMotion={reducedMotion}
					onToggle={() => setExpanded(!isExpanded)}
				/>
			)}

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
						ref={liveScrollRef}
						style={{
							position: "relative",
							display: "flex",
							flexDirection: "column",
							gap: STEP_GAP,
							paddingTop: 9,
							...(hiddenCount > 0
								? {
										// Dissolve the outgoing step into the top edge
										// rather than clipping it on a hard line.
										maskImage: "linear-gradient(to bottom, transparent 0%, black 26%)",
										WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 26%)",
									}
								: {}),
						}}
					>
						{bodySteps.map((step, i) => (
							<div
								key={step.id}
								style={{
									opacity: opacityFor(i),
									transition: reducedMotion ? undefined : `opacity 520ms ${EASE}`,
								}}
							>
								<StepBlock
									step={step}
									dimmed={windowed && opacityFor(i) < 1}
									entering={
										revealing || (windowed && isStreaming && step.sequence >= previouslySeen)
									}
									enterDelayMs={
										revealing ? Math.min(i * REVEAL_STAGGER_MS, REVEAL_STAGGER_CAP_MS) : 0
									}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/** Shared chrome for the three header variants: same height, same type. */
const HEADER_STYLE = {
	display: "inline-flex",
	alignItems: "center",
	gap: 7,
	minHeight: HEADER_MIN_HEIGHT,
	padding: "4px 9px 4px 8px",
	marginLeft: -8,
	borderRadius: 6,
	fontSize: 12.5,
	letterSpacing: "-0.004em",
} as const;

/**
 * The pre-step line: the run has started and there is genuinely nothing to
 * report yet. The label resolves out of noise so the row reads as something
 * being computed rather than as dead air. The mark carries the same breathing
 * halo `ThinkingIndicator` gives this moment elsewhere — one brand beat, not
 * two treatments — and once a second has passed the live counter joins in,
 * turning the wait into measured time.
 */
function WaitingLine({
	label,
	mark,
	elapsed,
	reducedMotion,
}: {
	label?: string | null;
	mark?: ReactNode;
	elapsed?: number;
	reducedMotion: boolean;
}) {
	return (
		<div style={{ ...HEADER_STYLE, color: ink(52) }} role="status">
			<span
				aria-hidden
				style={{
					position: "relative",
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					width: 14,
					height: 14,
					flexShrink: 0,
				}}
			>
				<span
					style={{
						position: "absolute",
						inset: -6,
						borderRadius: "50%",
						background:
							"radial-gradient(closest-side, color-mix(in srgb, var(--chat-primary) 26%, transparent), transparent 72%)",
						animation:
							reducedMotion || !mark
								? undefined
								: `mf-halo-breathe 2.6s ${EASE} infinite`,
						opacity: reducedMotion ? 0.5 : undefined,
						pointerEvents: "none",
					}}
				/>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						width: 14,
						height: 14,
						animation: reducedMotion || !mark ? undefined : `mf-mark-breathe 2.6s ${EASE} infinite`,
					}}
				>
					{mark ?? <ActivityMeter reducedMotion={reducedMotion} />}
				</span>
			</span>
			{label ? (
				<DecodingText text={label} className="text-[var(--chat-text-subtle)]" />
			) : (
				<span style={{ color: ink(52), fontWeight: 500 }}>Working</span>
			)}
			{elapsed !== undefined && elapsed >= 1 && (
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
	interruptedCount,
	open,
	reducedMotion,
	entering = false,
	onToggle,
}: {
	seconds?: number;
	stepCount: number;
	writeCount: number;
	agentCount: number;
	failedCount: number;
	interruptedCount: number;
	open: boolean;
	reducedMotion: boolean;
	/** The run just finished in this instance: rise-and-fade the line in once.
	 *  History mounts stay still. */
	entering?: boolean;
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
				...HEADER_STYLE,
				background: hover ? ink(4) : "transparent",
				border: "none",
				cursor: "pointer",
				font: "inherit",
				fontSize: HEADER_STYLE.fontSize,
				transition: reducedMotion ? undefined : `background 180ms ${EASE}`,
				animation: entering ? `mf-row-enter 280ms ${EASE} both` : undefined,
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

			{interruptedCount > 0 && (
				<>
					<Dot />
					{/* Deliberately not the error colour: these did not fail, and
					    saying they did would be a different wrong answer. */}
					<span style={{ color: "var(--chat-warning, #b45309)", fontWeight: 560 }}>
						{interruptedCount} unfinished
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
function LiveLine({
	elapsed,
	totalSteps,
	showingAll,
	collapsed,
	canToggle,
	reducedMotion,
	onToggle,
}: {
	elapsed: number;
	totalSteps: number;
	showingAll: boolean;
	/** The answer has started and the steps are folded away. */
	collapsed: boolean;
	canToggle: boolean;
	reducedMotion: boolean;
	onToggle: () => void;
}) {
	const toggleLabel = showingAll
		? "Show less"
		: collapsed
			? `Show ${totalSteps} ${totalSteps === 1 ? "step" : "steps"}`
			: `Show all ${totalSteps} steps`;
	return (
		<div style={{ ...HEADER_STYLE, color: ink(42) }}>
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
					aria-expanded={showingAll}
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
					{toggleLabel}
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
