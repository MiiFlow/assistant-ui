import type { SubagentChunkData } from "../../types";

export type RunStepStatus = "pending" | "running" | "completed" | "failed";

/**
 * What a tool call DID, as declared server-side.
 *
 * Three values, not a richer taxonomy, because three is what the wire actually
 * knows. `undeclared` is a first-class answer: a tool that never said whether
 * it has side effects must not be drawn as a read, since that is the one
 * mistake with consequences for the person watching.
 */
export type RunStepToolKind = "read" | "write" | "undeclared";

/**
 * One tool call, rendered as an inline chip inside the thought that justified it.
 */
export interface RunStepTool {
	/** Provider tool-call id when available; otherwise a positional fallback. */
	id: string;
	/** Raw slug (`get_ad_performance`) — the hover title. */
	name: string;
	/** LLM-written prose, falling back to the slug. */
	label: string;
	/** True when `label` is only the slug, so it can render as an identifier. */
	isSlugOnly: boolean;
	/** Read, write, or undeclared. Drives the mark and the chip's weight. */
	kind: RunStepToolKind;
	status: RunStepStatus;
	/** Epoch ms. `endedAt` is undefined while the call is still open. */
	startedAt?: number;
	endedAt?: number;
	/** Bounded excerpt of a failed result, surfaced when the step is expanded. */
	observationExcerpt?: string;
}

/**
 * One unit of the transcript: a thought plus the tool calls it justified.
 *
 * The agent thinks, then acts, so a tool belongs to the thought immediately
 * preceding it. That is the same boundary the server's `RunTraceProjector`
 * already draws (`_finish_open_thinking` closes the open thought the moment a
 * tool arrives), which is why the grouping needs no extra signal on the wire.
 *
 * A `subagent` step is block-level rather than a chip — a dispatched thread is
 * not a chip — and carries no prose of its own.
 */
export interface RunStep {
	id: string;
	sequence: number;
	kind: "thinking" | "planning" | "subagent";
	status: RunStepStatus;
	/** Markdown prose. Absent when tools ran with no preceding thought. */
	text?: string;
	tools: RunStepTool[];
	/** Epoch ms. `endedAt` is undefined while the step is still open. */
	startedAt?: number;
	endedAt?: number;
	/**
	 * The specialists this step dispatched. Always at least one on a `subagent`
	 * step, empty otherwise.
	 *
	 * A LIST rather than a single value because `dispatch_assistant` is
	 * parallelizable: one parent step can gather several children, and showing
	 * them as separate stacked steps loses the fact that they ran at once. Only
	 * dispatches sharing a `dispatchStep` are collected here.
	 */
	subagents: SubagentChunkData[];
}
