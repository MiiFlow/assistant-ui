import { useEffect, useLayoutEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { stripCitationMarkers } from "../utils/citations";
import { injectBeamerKeyframes } from "../utils/beamer";
import { usePrefersReducedMotion } from "../hooks/use-reduced-motion";
import type { AgentTranscript } from "../types/transcript";
import type { StreamingChunk } from "../types";
import { MarkdownContent } from "./MarkdownContent";
import { buildFlow, specialistCalls, type FlowItem } from "./transcript/flow";
import {
	DEFAULT_ACTIVITY_LABELS,
	type ActivityLabels,
	type ActivityMarkRenderer,
	type ActivityState,
} from "./transcript/labels";
import { RunHeader } from "./transcript/RunHeader";
import { RunMark } from "./transcript/RunMark";
import { WorkLanes, laneStatus } from "./transcript/WorkLanes";

const MARK_STATE: Record<AgentTranscript["status"], ActivityState> = {
	running: "running",
	waiting: "waiting",
	completed: "done",
	failed: "failed",
	stopped: "stopped",
};

/** The header's state word for every status but completion, which carries a duration. */
const STATE_LABEL: Record<Exclude<AgentTranscript["status"], "completed">, "working" | "waiting" | "failed" | "stopped"> = {
	running: "working",
	waiting: "waiting",
	failed: "failed",
	stopped: "stopped",
};

/** The nearest scrolling ancestor: the chat viewport, not the window. */
function scrollViewport(element: HTMLElement | null | undefined): HTMLElement | null {
	let viewport = element?.parentElement ?? null;
	while (viewport && !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)) {
		viewport = viewport.parentElement;
	}
	return viewport;
}

const clockOf = (seconds: number) => {
	const s = Math.floor(seconds);
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Stable chronological slots; receiving a tool never relocates prior speech.
 *
 * The run is drawn as a rail: speech, reasoning and work in order, with work
 * that ran concurrently forked into lanes. The one live slot carries the
 * activity accent, so the eye lands on where execution is now. On completion
 * the rail folds behind the header and the final answer stands alone.
 */
export function TranscriptFlow({
	transcript,
	chunks,
	isStreaming,
	renderText,
	executionTime,
	streamStartedAt,
	activityMark,
	activityLabels,
	waitingMark,
}: {
	transcript: AgentTranscript;
	chunks?: StreamingChunk[];
	isStreaming?: boolean;
	executionTime?: number;
	streamStartedAt?: number;
	renderText: (text: string, streaming?: boolean) => ReactNode;
	/** Host mark for the header; the package's unbranded mark otherwise. */
	activityMark?: ActivityMarkRenderer;
	/** Overrides for any header or lane string. */
	activityLabels?: Partial<ActivityLabels>;
	/** A host's static waiting mark; stands in for `activityMark` while the
	 *  run works or waits, so hosts that only set `waitingMark` keep their mark. */
	waitingMark?: ReactNode;
}) {
	const status =
		transcript.status === "running" && !isStreaming
			? "stopped"
			: transcript.status;
	const labels = useMemo(() => ({ ...DEFAULT_ACTIVITY_LABELS, ...activityLabels }), [activityLabels]);
	const reducedMotion = usePrefersReducedMotion();
	const root = useRef<HTMLDivElement>(null);
	const regionId = useId();
	const [keepOpen, setKeepOpen] = useState(false);
	const [expanded, setExpanded] = useState<boolean | null>(null);
	// Whether this message was on screen while it ran. Only then may anything
	// perform an entrance or a completion; a loaded transcript mounts settled.
	const [watchedLive] = useState(status === "running");
	useEffect(() => {
		injectBeamerKeyframes(root.current);
	}, []);
	// Observe the actual chat viewport, not window scroll. Reading older content
	// is a reason to preserve the layout even if no disclosure was opened.
	useEffect(() => {
		const viewport = scrollViewport(root.current);
		if (!viewport) return;
		let previous = viewport.scrollTop;
		const onScroll = () => {
			if (viewport.scrollTop < previous - 1) setKeepOpen(true);
			previous = viewport.scrollTop;
		};
		viewport.addEventListener("scroll", onScroll, { passive: true });
		return () => viewport.removeEventListener("scroll", onScroll);
	}, []);

	// New snapshots identify the final answer explicitly. Older v1 snapshots
	// retain their last uninterrupted speech block as the answer.
	const explicitFinal = transcript.blocks.some((b) => b.isFinal);
	const lastText = transcript.blocks.reduce((last, b, i) =>
		b.kind === "text" && !b.interrupted ? i : last, -1);
	const isAnswer = (index: number) => {
		const block = transcript.blocks[index];
		return status === "completed" && block.kind === "text" && !block.interrupted &&
			(explicitFinal ? !!block.isFinal : index === lastText);
	};
	const hasAnswer = transcript.blocks.some((_, index) => isAnswer(index));
	const hasWork = transcript.blocks.some((_, index) => !isAnswer(index));
	const canFold = status === "completed" && hasAnswer && hasWork;
	const workOpen = expanded ?? (!canFold || keepOpen);

	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		if (status !== "running") return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [status]);

	const flow = buildFlow(transcript.blocks, chunks ?? [], (index) => !isAnswer(index));

	// Header figures.
	const seconds = status === "running" && streamStartedAt
		? Math.max(0, (now - streamStartedAt) / 1000) : executionTime;
	const duration = seconds != null && seconds > 0
		? seconds < 60 ? `${Math.floor(seconds)}s` : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
		: null;
	let agents = 0;
	let liveAgents = 0;
	let calls = 0;
	for (const item of flow) {
		if (item.type !== "work") continue;
		for (const unit of item.units) {
			if (unit.kind === "tool") {
				calls += 1;
				continue;
			}
			agents += 1;
			if (laneStatus(unit, status) === "running") liveAgents += 1;
			calls += specialistCalls(unit.data).length;
		}
	}
	const running = status === "running";
	const label = status === "completed" ? labels.worked(duration) : labels[STATE_LABEL[status]];
	const stats = [
		agents ? labels.agents(agents, running ? liveAgents : 0) : "",
		calls ? labels.calls(calls) : "",
	].filter(Boolean);
	const markState = MARK_STATE[status];
	// `live` means "may perform its completion", so reduced motion clears it
	// for every mark, not only the package's own.
	const markLive = watchedLive && !reducedMotion;
	const mark = activityMark
		? activityMark(markState, { live: markLive })
		: waitingMark && (markState === "running" || markState === "waiting")
			? waitingMark
			: <RunMark state={markState} live={markLive} />;

	// Fold toggle keeps the header where the reader's eye is.
	const anchor = useRef<{ viewport: HTMLElement; y: number } | null>(null);
	const header = useRef<HTMLButtonElement>(null);
	const toggle = () => {
		const viewport = scrollViewport(root.current);
		if (viewport && header.current) {
			// Use the scroll engine's existing user-intent path to release bottom
			// following before the content resize, just like dragging its scrollbar.
			viewport.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 0 }));
			anchor.current = { viewport, y: header.current.getBoundingClientRect().top };
		}
		setExpanded(!workOpen);
	};
	useLayoutEffect(() => {
		const saved = anchor.current;
		if (!saved || !header.current) return;
		const restore = () => {
			if (header.current) saved.viewport.scrollTop += header.current.getBoundingClientRect().top - saved.y;
		};
		restore();
		const frame = requestAnimationFrame(restore);
		anchor.current = null;
		return () => cancelAnimationFrame(frame);
	}, [expanded]);

	// Rail slots that arrive after mount enter; those present at mount do not.
	// Read-only after init: a slot's entrance class stays on it, and a CSS
	// animation runs once per element, so nothing needs marking as seen.
	const atMount = useRef<Set<string> | null>(null);
	if (atMount.current === null) atMount.current = new Set(flow.map((item) => item.id));
	const lastItem = flow[flow.length - 1];

	const renderItem = (item: FlowItem) => {
		const slot = { id: `${regionId}-${item.index}`, "data-transcript-block": item.id };
		const isLast = item === lastItem;
		let state: "live" | "done" | "failed" | "idle" = "idle";
		let body: ReactNode;
		if (item.type === "text") {
			const live = running && !!isStreaming && isLast;
			state = live ? "live" : "idle";
			body = (
				<>
					{renderText(stripCitationMarkers(item.block.text || ""), live)}
					{item.block.interrupted && (
						<p className="text-xs text-muted-foreground">{labels.responseInterrupted}</p>
					)}
				</>
			);
		} else if (item.type === "reasoning") {
			const live = running && !!isStreaming && isLast;
			state = live ? "live" : "idle";
			body = (
				<details className="mf-tx-reasoning">
					<summary className="mf-tx-caps">{labels.reasoning}</summary>
					<div className="mf-tx-reasoning-body">
						<MarkdownContent isStreaming={live}>{item.block.text || ""}</MarkdownContent>
					</div>
				</details>
			);
		} else {
			const statuses = item.units.map((unit) => laneStatus(unit, status));
			// A lane's own failure is marked on the lane; the node fails only when
			// nothing in the item came back.
			state = statuses.some((s) => s === "running") && running
				? "live"
				: statuses.every((s) => s === "failed" || s === "interrupted")
					? "failed"
					: statuses.every((s) => s === "done" || s === "failed")
						? "done"
						: "idle";
			body = (
				<WorkLanes
					units={item.units}
					run={status}
					now={now}
					labels={labels}
					reducedMotion={reducedMotion}
					animate={watchedLive && !reducedMotion}
				/>
			);
		}
		const enter = watchedLive && !reducedMotion && !atMount.current!.has(item.id);
		return (
			<div
				{...slot}
				key={item.id}
				className={`mf-tx-row mf-tx-k-${item.type}${enter ? " mf-tx-enter" : ""}`}
				data-state={state}
			>
				<span className="mf-tx-node" aria-hidden />
				{state === "live" && !reducedMotion && <span className="mf-tx-pulse" aria-hidden />}
				<div className="mf-tx-body">{body}</div>
			</div>
		);
	};

	// The answer's hairline sweeps once, only when the reader watched the run end.
	const sweep = watchedLive && status === "completed" && !reducedMotion;
	const showHeader = hasWork || status !== "completed";

	return (
		<div ref={root} className="mf-tx" data-agent-transcript="1"
			onClickCapture={(event) => {
				if ((event.target as HTMLElement).closest("summary, button") &&
						!(event.target as HTMLElement).closest("[data-work-toggle]")) setKeepOpen(true);
			}}>
			{showHeader && (
				<RunHeader
					ref={header}
					status={status}
					mark={mark}
					label={label}
					clock={running ? clockOf(seconds ?? 0) : null}
					stats={stats}
					foldable={canFold}
					open={workOpen}
					controls={regionId}
					toggleTitle={canFold ? (workOpen ? labels.collapse : labels.expand) : undefined}
					onToggle={toggle}
				/>
			)}
			<div id={regionId} className="mf-tx-rail" data-activity-panel
				hidden={!hasWork || (canFold && !workOpen)}
				role="region" aria-label={labels.activityRegion}>
				{flow.map(renderItem)}
			</div>
			{transcript.blocks.map((block, index) => isAnswer(index) ? (
				<div key={block.id} id={`${regionId}-${index}`} data-transcript-block={block.id}
					className="mf-tx-answer" data-after-work={showHeader ? "" : undefined}
					data-sweep={sweep ? "" : undefined}>
					{renderText(stripCitationMarkers(block.text || ""), false)}
				</div>
			) : null)}
		</div>
	);
}
