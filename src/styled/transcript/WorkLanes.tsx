import { useRef, useState } from "react";
import type { AgentTranscript } from "../../types/transcript";
import { TEXT_SHIMMER_STYLE, formatDuration, formatElapsed } from "../reasoning/atoms";
import { SubagentBody, humanizeHandle } from "../reasoning/SubagentBlock";
import { humanizeToolName } from "../reasoning/tool-label";
import { specialistCalls, type WorkUnit } from "./flow";
import type { ActivityLabels } from "./labels";

type RunStatus = AgentTranscript["status"];
type LaneStatus = "queued" | "running" | "waiting" | "done" | "failed" | "interrupted";

export function laneStatus(unit: WorkUnit, run: RunStatus): LaneStatus {
	if (unit.kind === "tool" ? unit.chunk.success === false : unit.data.status === "failed") return "failed";
	if (unit.finished) return "done";
	if (run === "waiting") return "waiting";
	if (run !== "running") return "interrupted";
	if (unit.kind === "tool" && unit.chunk.status !== "executing" && unit.startedAt == null) return "queued";
	return "running";
}

/** Seconds a unit ran, live against `now` while it runs. */
function laneSeconds(unit: WorkUnit, status: LaneStatus, now: number): number | undefined {
	if (unit.startedAt != null) {
		const end = unit.endedAt ?? (status === "running" ? now : undefined);
		if (end != null && end >= unit.startedAt) return (end - unit.startedAt) / 1000;
	}
	const ms = unit.kind === "subagent" ? unit.data.durationMs : undefined;
	return ms != null && ms > 0 ? ms / 1000 : undefined;
}

const firstLine = (text?: string) => (text ?? "").trim().split("\n")[0]?.slice(0, 160) ?? "";

function describe(unit: WorkUnit, status: LaneStatus, labels: ActivityLabels) {
	if (unit.kind === "subagent") {
		const data = unit.data;
		const calls = specialistCalls(data);
		const current = calls[calls.length - 1];
		const action =
			status === "done"
				? `${labels.done} · ${labels.calls(calls.length)}`
				: status === "failed"
					? firstLine(data.result) || labels.failed
					: status === "interrupted"
						? labels.interrupted
						: status === "waiting"
							? labels.awaitingApproval
							: current
								? current.toolDescription || humanizeToolName(current.toolName)
								: labels.queued;
		return { title: humanizeHandle(data.subagentType), handle: data.subagentType, action };
	}
	const chunk = unit.chunk;
	const action =
		status === "failed"
			? firstLine(chunk.content) || labels.failed
			: status === "interrupted"
				? labels.interrupted
				: status === "waiting"
					? labels.awaitingApproval
					: status === "queued"
						? labels.queued
						: "";
	return {
		title: chunk.toolDescription || humanizeToolName(chunk.toolName),
		handle: chunk.toolName ?? "",
		action,
	};
}

function ToolOutput({ unit, status }: { unit: WorkUnit; status: LaneStatus }) {
	const { toolName, toolArgs, content } = unit.chunk;
	const args = toolArgs && Object.keys(toolArgs).length > 0 ? JSON.stringify(toolArgs) : "";
	return (
		<div className="mf-tx-term">
			<span>{`$ ${toolName ?? ""}${args ? ` ${args.length > 400 ? `${args.slice(0, 400)}…` : args}` : ""}`}</span>
			{"\n"}
			<span className="mf-tx-term-out">
				{content ? content : status === "running" || status === "queued" ? "…" : "No result."}
			</span>
		</div>
	);
}

function Lane({
	unit,
	run,
	now,
	fork,
	labels,
	reducedMotion,
	enter,
}: {
	unit: WorkUnit;
	run: RunStatus;
	now: number;
	fork: boolean;
	labels: ActivityLabels;
	reducedMotion: boolean;
	enter: boolean;
}) {
	const [open, setOpen] = useState(false);
	const status = laneStatus(unit, run);
	const { title, handle, action } = describe(unit, status, labels);
	const seconds = laneSeconds(unit, status, now);
	const running = status === "running";
	const shimmer = running && !reducedMotion ? TEXT_SHIMMER_STYLE : undefined;
	// A running specialist's news is what it is doing; a running tool's is itself.
	const shimmerAction = unit.kind === "subagent";
	return (
		<div className={`mf-tx-lane${enter ? " mf-tx-enter" : ""}`} data-status={status}>
			{fork && running && !reducedMotion && <span className="mf-tx-flow" aria-hidden />}
			<button
				type="button"
				className="mf-tx-lane-row mf-focus"
				title={handle || undefined}
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				<span className="mf-tx-led" aria-hidden />
				<span className="mf-tx-lane-name">
					<span className="mf-tx-lane-title" style={shimmerAction ? undefined : shimmer}>
						{title}
					</span>
					{unit.kind === "tool" && unit.chunk.toolWrites && <span className="mf-tx-tag">{labels.write}</span>}
				</span>
				{action && (
					<span className="mf-tx-lane-act" style={shimmerAction ? shimmer : undefined}>
						{action}
					</span>
				)}
				<span className="mf-tx-lane-time">
					{seconds == null ? "" : running ? formatElapsed(seconds) : formatDuration(seconds)}
				</span>
			</button>
			{open && (
				<div className="mf-tx-lane-body">
					{unit.kind === "subagent" ? <SubagentBody data={unit.data} /> : <ToolOutput unit={unit} status={status} />}
				</div>
			)}
		</div>
	);
}

/**
 * Work on the rail. One unit is a single row; several that ran together fork
 * into lanes with a shared header, and merge into one summary line once every
 * lane has returned — including what running them together saved.
 */
export function WorkLanes({
	units,
	run,
	now,
	labels,
	reducedMotion,
	animate,
}: {
	units: WorkUnit[];
	run: RunStatus;
	now: number;
	labels: ActivityLabels;
	reducedMotion: boolean;
	/** Animate lanes that arrive after mount (a live run, never a replay). */
	animate: boolean;
}) {
	// Lanes present at mount never animate. Read-only after init: a lane's
	// entrance class stays on it, and a CSS animation runs once per element.
	const atMount = useRef<Set<string> | null>(null);
	if (atMount.current === null) atMount.current = new Set(units.map((u) => u.id));
	const fork = units.length > 1;
	const statuses = units.map((unit) => laneStatus(unit, run));
	const live = statuses.filter((s) => s === "running").length;
	const settled = statuses.every((s) => s === "done" || s === "failed");
	const kinds = new Set(units.map((u) => u.kind));
	const title =
		kinds.size > 1
			? labels.tasks(units.length)
			: kinds.has("subagent")
				? labels.specialists(units.length)
				: labels.toolCalls(units.length);

	let merge: { lead: string; figures: string[]; gain: string | null } | null = null;
	if (fork && settled) {
		const timed = units.every((u) => u.startedAt != null && u.endedAt != null);
		merge = {
			lead: labels.returned(statuses.filter((s) => s === "done").length, units.length),
			figures: [],
			gain: null,
		};
		if (timed) {
			const start = Math.min(...units.map((u) => u.startedAt!));
			const end = Math.max(...units.map((u) => u.endedAt!));
			const wall = (end - start) / 1000;
			const total = units.reduce((sum, u) => sum + (u.endedAt! - u.startedAt!) / 1000, 0);
			if (wall > 0) {
				merge.figures = [labels.elapsed(formatDuration(wall)), labels.totalWork(formatDuration(total))];
				const factor = total / wall;
				if (factor >= 1.1) merge.gain = labels.faster(factor.toFixed(1));
			}
		}
	}

	const lanes = units.map((unit) => {
		const enter = animate && !atMount.current!.has(unit.id);
		return (
			<Lane
				key={unit.id}
				unit={unit}
				run={run}
				now={now}
				fork={fork}
				labels={labels}
				reducedMotion={reducedMotion}
				enter={enter}
			/>
		);
	});

	if (!fork) return <div className="mf-tx-lanes">{lanes}</div>;
	return (
		<div>
			<div className="mf-tx-grp-head">
				<span className="mf-tx-caps">{labels.parallel}</span>
				<span className="mf-tx-grp-title">{title}</span>
				{live > 0 && run === "running" && <span className="mf-tx-grp-live">{labels.running(live)}</span>}
			</div>
			<div className="mf-tx-lanes" data-fork="" data-merged={merge ? "" : undefined}>
				{lanes}
			</div>
			{merge && (
				<div className="mf-tx-merge">
					<span className="mf-tx-merge-lead">{merge.lead}</span>
					{merge.figures.map((figure, i) => (
						<span key={i}>{figure}</span>
					))}
					{merge.gain && <span className="mf-tx-merge-gain">{merge.gain}</span>}
				</div>
			)}
		</div>
	);
}
