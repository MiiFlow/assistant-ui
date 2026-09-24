import type { StreamingChunk, SubagentChunkData } from "../../types";
import type { AgentTranscript, TranscriptBlock } from "../../types/transcript";
import { isInternalTool } from "../reasoning/build-steps";

interface WorkUnitBase {
	id: string;
	block: TranscriptBlock;
	chunk: StreamingChunk;
	step?: number | string;
	/** Epoch ms the unit actually started running, when known. */
	startedAt?: number;
	/** Epoch ms the unit returned, when known. */
	endedAt?: number;
	finished: boolean;
}

/** One unit of work on the rail: a tool call or a dispatched specialist. */
export type WorkUnit =
	| (WorkUnitBase & { kind: "tool" })
	| (WorkUnitBase & { kind: "subagent"; data: SubagentChunkData });

export type FlowItem =
	| { type: "text"; id: string; index: number; block: TranscriptBlock }
	| { type: "reasoning"; id: string; index: number; block: TranscriptBlock }
	| { type: "work"; id: string; index: number; units: WorkUnit[] };

function toolUnit(block: TranscriptBlock): WorkUnit | null {
	const chunk = block.chunk;
	if (!chunk || isInternalTool(chunk.toolName)) return null;
	return {
		id: block.id,
		kind: "tool",
		block,
		chunk,
		step: block.step,
		startedAt: chunk.startedAt,
		endedAt: chunk.endedAt,
		finished: chunk.status === "completed" || chunk.success === false,
	};
}

function subagentUnit(block: TranscriptBlock, chunks: readonly StreamingChunk[]): WorkUnit | null {
	const chunk = chunks.find((c) => c.subagentData?.subagentId === block.subagentId);
	const data = chunk?.subagentData;
	if (!chunk || !data) return null;
	const finished = data.status !== "running";
	const endedAt =
		chunk.endedAt ??
		(finished && chunk.startedAt != null && data.durationMs != null
			? chunk.startedAt + data.durationMs
			: undefined);
	return {
		id: block.id,
		kind: "subagent",
		block,
		chunk,
		data,
		step: block.step ?? data.dispatchStep,
		startedAt: chunk.startedAt,
		endedAt,
		finished,
	};
}

/**
 * Whether `unit` ran alongside the group rather than after it.
 *
 * Specialists that share a dispatch step were launched by one gather — the
 * orchestrator's fact. Tools in one step may run staged or throttled, so for
 * them concurrency is read from measured intervals: the unit started before
 * some member of the group had returned.
 */
function runsAlongside(group: readonly WorkUnit[], unit: WorkUnit): boolean {
	if (unit.step == null || group.some((member) => member.step !== unit.step)) return false;
	if (unit.kind === "subagent" && group.every((member) => member.kind === "subagent")) return true;
	if (unit.startedAt == null) return false;
	return group.some(
		(member) =>
			member.startedAt != null &&
			member.startedAt <= unit.startedAt! &&
			(member.endedAt == null ? !member.finished : member.endedAt > unit.startedAt!),
	);
}

/**
 * The rail's items in transcript order: speech, reasoning, and work — where
 * consecutive work that ran concurrently is gathered into one item so it can
 * be drawn as a fork rather than as a sequence.
 */
export function buildFlow(
	blocks: AgentTranscript["blocks"],
	chunks: readonly StreamingChunk[],
	include: (index: number) => boolean,
): FlowItem[] {
	const items: FlowItem[] = [];
	blocks.forEach((block, index) => {
		if (!include(index)) return;
		if (block.kind === "text" || block.kind === "reasoning") {
			items.push(
				block.kind === "text"
					? { type: "text", id: block.id, index, block }
					: { type: "reasoning", id: block.id, index, block },
			);
			return;
		}
		const unit = block.kind === "tool" ? toolUnit(block) : subagentUnit(block, chunks);
		if (!unit) return;
		const last = items[items.length - 1];
		if (last?.type === "work" && runsAlongside(last.units, unit)) {
			last.units.push(unit);
			return;
		}
		items.push({ type: "work", id: block.id, index, units: [unit] });
	});
	return items;
}

/** Tool calls a specialist made, excluding machinery. */
export function specialistCalls(data: SubagentChunkData): StreamingChunk[] {
	return (data.nestedChunks ?? []).filter((c) => c.type === "tool" && !isInternalTool(c.toolName));
}
