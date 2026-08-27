import type { StreamingChunk, SubagentChunkData } from "../../types";
import type { RunStep, RunStepStatus, RunStepTool, RunStepToolKind } from "./types";

/**
 * Tools that are machinery rather than work the user asked for.
 *
 * `dispatch_assistant` is the odd one: the call IS user-relevant, but it
 * arrives a second time as a `subagent` chunk carrying the child's whole
 * thread, and that is the rendering we want — so the bare tool row is dropped
 * to avoid showing one dispatch twice.
 *
 * This is the ONLY copy. `ReasoningPanel`, `EventTimeline` and `PlanTimeline`
 * each kept their own, which is how they drifted apart.
 */
export const INTERNAL_TOOLS = new Set([
	"create_plan",
	"tool_search",
	"unknown",
	"dispatch_assistant",
]);

export function isInternalTool(toolName?: string): boolean {
	if (!toolName) return false;
	return INTERNAL_TOOLS.has(toolName.toLowerCase().trim());
}

/** Longest failed-result excerpt worth carrying into a step. */
const OBSERVATION_EXCERPT_CHARS = 400;

function toolStatus(chunk: StreamingChunk): RunStepStatus {
	if (chunk.success === false) return "failed";
	if (chunk.status === "completed") return "completed";
	if (chunk.status === "executing") return "running";
	return "pending";
}

/**
 * Read, write, or undeclared — from the declaration only.
 *
 * There is deliberately no name-shape fallback here. `audit/checker.py` keeps
 * one for unannotated customer MCP tools and documents why its default is
 * "assume write": guessing read costs an unaudited change nobody hears about.
 * A second copy of that guess on the render side would drift from the
 * declarations and could label a live budget change as a harmless read.
 */
function toolKind(chunk: StreamingChunk): RunStepToolKind {
	if (chunk.toolWrites === true) return "write";
	if (chunk.toolWrites === false) return "read";
	return "undeclared";
}

/** A batch is running while any member is, and failed if any member failed. */
function groupStatus(members: readonly SubagentChunkData[]): RunStepStatus {
	if (members.some((m) => m.status === "running")) return "running";
	if (members.some((m) => m.status === "failed")) return "failed";
	return "completed";
}

function isProse(chunk: StreamingChunk): boolean {
	return chunk.type === "thinking" || chunk.type === "planning";
}

/**
 * Group a flat chunk stream into the steps the transcript renders.
 *
 * The one grouping rule, applied to every source: a step opens on a thought (or
 * on a tool with no thought before it) and closes when the next thought or
 * sub-agent dispatch arrives. Both producers — the live SSE reducers and
 * `runTraceStepsToChunks` replaying a durable trace — hand over the same chunk
 * shape, so both get the same result and a reloaded thread looks like the run
 * the user watched.
 *
 * `isStreaming` decides only whether the trailing step may render as running:
 * on a finished run nothing is open, however the last chunk happened to look.
 */
export function buildRunSteps(
	chunks: readonly StreamingChunk[] | undefined,
	isStreaming = false,
): RunStep[] {
	if (!chunks || chunks.length === 0) return [];

	const steps: RunStep[] = [];
	// The step tool chips attach to. Null between a sub-agent dispatch and the
	// next thought, so a tool that follows a dispatch opens its own step rather
	// than being hung off prose it has nothing to do with.
	let open: RunStep | null = null;

	const push = (step: RunStep): RunStep => {
		steps.push(step);
		return step;
	};

	const startStep = (
		kind: RunStep["kind"],
		chunk: StreamingChunk,
		index: number,
	): RunStep =>
		push({
			id: `${kind}-${chunk.sequence ?? index}`,
			sequence: steps.length,
			kind,
			status: "completed",
			text: isProse(chunk) ? chunk.content : undefined,
			tools: [],
			subagents: [],
			startedAt: chunk.startedAt,
			endedAt: chunk.endedAt,
		});

	chunks.forEach((chunk, index) => {
		if (isProse(chunk)) {
			// An empty thought is a chunk that was opened and never filled —
			// rendering it would be a blank paragraph.
			if (!chunk.content || chunk.content.trim().length === 0) return;
			open = startStep(chunk.type === "planning" ? "planning" : "thinking", chunk, index);
			return;
		}

		// Historical Plan & Execute messages, persisted before the unified-ReAct
		// migration. Their work lives in `subtaskData` rather than in prose, so
		// it is downgraded into the same step vocabulary — otherwise those
		// threads would replay with their reasoning missing entirely.
		if (chunk.type === "subtask" && chunk.subtaskData) {
			const subtask = chunk.subtaskData;
			const startedAt = chunk.startedAt;
			open = push({
				id: `subtask-${subtask.id}-${index}`,
				sequence: steps.length,
				kind: "thinking",
				status: subtask.status === "failed" ? "failed" : "completed",
				text: subtask.description,
				tools: [],
				subagents: [],
				startedAt,
				endedAt:
					chunk.endedAt ??
					(startedAt !== undefined && subtask.execution_time
						? startedAt + subtask.execution_time * 1000
						: undefined),
			});
			return;
		}

		if (chunk.type === "subagent" && chunk.subagentData) {
			const data = chunk.subagentData;
			// Join the step immediately before if it gathered this child from the
			// SAME parent step. `dispatchStep` is the orchestrator's own fact, not
			// a guess from overlapping clocks — and an undefined one never joins,
			// so a run predating the field shows sequential rows rather than
			// claiming a concurrency the data cannot support.
			const previous = steps[steps.length - 1];
			const sameBatch =
				previous !== undefined &&
				previous.kind === "subagent" &&
				data.dispatchStep !== undefined &&
				previous.subagents[0]?.dispatchStep === data.dispatchStep;

			if (sameBatch) {
				previous.subagents.push(data);
				previous.status = groupStatus(previous.subagents);
				if (chunk.startedAt !== undefined) {
					previous.startedAt =
						previous.startedAt === undefined
							? chunk.startedAt
							: Math.min(previous.startedAt, chunk.startedAt);
				}
				// The group ends when its LAST member does; one child finishing
				// early must not report the batch as over.
				previous.endedAt =
					previous.endedAt === undefined || chunk.endedAt === undefined
						? undefined
						: Math.max(previous.endedAt, chunk.endedAt);
			} else {
				push({
					id: `subagent-${data.subagentId}-${index}`,
					sequence: steps.length,
					kind: "subagent",
					status: groupStatus([data]),
					tools: [],
					subagents: [data],
					startedAt: chunk.startedAt,
					endedAt: chunk.endedAt,
				});
			}
			// A dispatch is its own section; the next tool starts fresh.
			open = null;
			return;
		}

		if (chunk.type === "tool") {
			if (isInternalTool(chunk.toolName)) return;

			// No thought preceded this call — give it a text-less step rather
			// than attaching it to whatever came before.
			if (!open) {
				open = push({
					id: `tools-${chunk.sequence ?? index}`,
					sequence: steps.length,
					kind: "thinking",
					status: "completed",
					tools: [],
					subagents: [],
					startedAt: chunk.startedAt,
					endedAt: chunk.endedAt,
				});
			}

			const description = chunk.toolDescription?.trim();
			const hasDescription = !!description;
			open.tools.push({
				id: chunk.toolCallId || `${chunk.toolName ?? "tool"}-${index}`,
				name: chunk.toolName || "Tool call",
				label: hasDescription ? description! : chunk.toolName || "Tool call",
				isSlugOnly: !hasDescription,
				kind: toolKind(chunk),
				status: toolStatus(chunk),
				startedAt: chunk.startedAt,
				endedAt: chunk.endedAt,
			});
			return;
		}

		if (chunk.type === "observation") {
			if (isInternalTool(chunk.toolName)) return;
			// An observation is not its own row; it is what closes the tool it
			// belongs to. Match by tool_call_id — the name alone is ambiguous
			// when a turn runs the same tool several times in parallel.
			const target = findTool(steps, chunk);
			if (!target) return;
			target.endedAt ??= chunk.endedAt ?? chunk.startedAt;
			if (chunk.success === false) {
				target.status = "failed";
				const excerpt = (chunk.content || "").trim();
				if (excerpt) target.observationExcerpt = excerpt.slice(0, OBSERVATION_EXCERPT_CHARS);
			} else if (target.status !== "failed") {
				target.status = "completed";
			}
		}
	});

	return finalizeStatuses(steps, isStreaming);
}

/**
 * Locate the tool an observation closes. Searches from the end because a
 * repeated same-name call on an id-less legacy path should close the most
 * recent one, not the first.
 */
function findTool(steps: RunStep[], chunk: StreamingChunk): RunStepTool | undefined {
	const callId = chunk.toolCallId;
	const name = chunk.toolName?.toLowerCase().trim();

	for (let i = steps.length - 1; i >= 0; i--) {
		const tools = steps[i].tools;
		for (let j = tools.length - 1; j >= 0; j--) {
			const tool = tools[j];
			if (callId) {
				if (tool.id === callId) return tool;
				continue;
			}
			if (name && tool.name.toLowerCase().trim() === name && tool.status !== "completed") {
				return tool;
			}
		}
	}
	return undefined;
}

/**
 * Resolve each step's status from its own clock and its tools'.
 *
 * The trailing step is the only one that may be `running`, and only while the
 * run is live. This is where the old panel went wrong in the other direction:
 * it hard-coded every thought to `completed`, so the shimmer and the breathing
 * marker it had built for live reasoning never fired on a thought at all.
 */
function finalizeStatuses(steps: RunStep[], isStreaming: boolean): RunStep[] {
	steps.forEach((step, index) => {
		const isLast = index === steps.length - 1;

		if (step.kind === "subagent") {
			// Nothing is open on a finished run; a specialist left mid-flight is a
			// run that was stopped, not one still working.
			if (!isStreaming && step.status === "running") step.status = "completed";
			return;
		}

		const failed = step.tools.some((t) => t.status === "failed");
		const toolOpen = step.tools.some((t) => t.status === "pending" || t.status === "running");

		if (!isStreaming) {
			// Nothing is open on a finished run; a tool left mid-flight is a
			// run that was stopped, not a tool still working.
			step.tools.forEach((t) => {
				if (t.status === "pending" || t.status === "running") t.status = "completed";
			});
			step.status = failed ? "failed" : "completed";
			return;
		}

		if (failed) {
			step.status = "failed";
			return;
		}
		// Prose is still arriving if this is the tail step and nothing closed it.
		step.status = isLast && (toolOpen || step.endedAt === undefined) ? "running" : "completed";
	});

	return steps;
}

/** Seconds between two epoch-ms stamps, or undefined when either is missing. */
export function durationSeconds(
	startedAt?: number,
	endedAt?: number,
): number | undefined {
	if (typeof startedAt !== "number" || typeof endedAt !== "number") return undefined;
	const seconds = (endedAt - startedAt) / 1000;
	// A negative figure means the two stamps came from different clocks (a
	// rolling deploy mixing server `ts` with client arrival time). Drop it
	// rather than render a nonsense duration.
	return seconds > 0 ? seconds : undefined;
}

/** Total wall clock the steps span, for the collapsed summary line. */
export function stepsWallClockSeconds(steps: readonly RunStep[]): number | undefined {
	let first: number | undefined;
	let last: number | undefined;

	for (const step of steps) {
		const stamps = [step.startedAt, step.endedAt, ...step.tools.flatMap((t) => [t.startedAt, t.endedAt])];
		for (const stamp of stamps) {
			if (typeof stamp !== "number") continue;
			if (first === undefined || stamp < first) first = stamp;
			if (last === undefined || stamp > last) last = stamp;
		}
	}

	return durationSeconds(first, last);
}
