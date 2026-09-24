import type { ReactNode } from "react";

/** The run's state as the activity header shows it. */
export type ActivityState = "running" | "waiting" | "done" | "failed" | "stopped";

/**
 * A host's mark for the activity header, drawn per state.
 *
 * `live` is true when this message was on screen while it ran, so a mark can
 * play its completion once. It is false for a message loaded already finished,
 * which must not perform.
 */
export type ActivityMarkRenderer = (state: ActivityState, meta: { live: boolean }) => ReactNode;

/** Every string the activity header and lanes render. Override any subset. */
export interface ActivityLabels {
	working: string;
	waiting: string;
	failed: string;
	stopped: string;
	/** `duration` is null when the run reported no time. */
	worked: (duration: string | null) => string;
	agents: (count: number, live: number) => string;
	calls: (count: number) => string;
	parallel: string;
	specialists: (count: number) => string;
	toolCalls: (count: number) => string;
	tasks: (count: number) => string;
	running: (count: number) => string;
	returned: (ok: number, total: number) => string;
	elapsed: (duration: string) => string;
	totalWork: (duration: string) => string;
	faster: (factor: string) => string;
	queued: string;
	awaitingApproval: string;
	interrupted: string;
	done: string;
	reasoning: string;
	collapse: string;
	expand: string;
	/** Tag on a tool call that changes data. */
	write: string;
	/** Accessible name of the activity region. */
	activityRegion: string;
	/** Under speech a retry or failure cut short. */
	responseInterrupted: string;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const DEFAULT_ACTIVITY_LABELS: ActivityLabels = {
	working: "Working",
	waiting: "Waiting for input",
	failed: "Run failed",
	stopped: "Stopped",
	worked: (duration) => (duration ? `Worked for ${duration}` : "Worked"),
	agents: (count, live) => (live > 0 ? `${live}/${count} agents live` : plural(count, "agent")),
	calls: (count) => plural(count, "call"),
	parallel: "Parallel",
	specialists: (count) => plural(count, "specialist"),
	toolCalls: (count) => plural(count, "tool call"),
	tasks: (count) => plural(count, "task"),
	running: (count) => `${count} running`,
	returned: (ok, total) => (ok === total ? "All returned" : `${ok} of ${total} returned`),
	elapsed: (duration) => `${duration} elapsed`,
	totalWork: (duration) => `${duration} total work`,
	faster: (factor) => `${factor}× faster in parallel`,
	queued: "Queued",
	awaitingApproval: "Waiting for approval",
	interrupted: "Interrupted",
	done: "Done",
	reasoning: "Reasoning",
	collapse: "Collapse activity",
	expand: "Expand activity",
	write: "write",
	activityRegion: "Agent activity",
	responseInterrupted: "Response interrupted",
};
