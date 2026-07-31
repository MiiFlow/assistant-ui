/**
 * Which accumulated tool row an SSE tool frame updates.
 *
 * Shared by every reducer that folds `assistant_chunk` frames into reasoning
 * chunks — the embed's `useMiiflowChat` parser and the web dashboard's live
 * SSE + active-run replay reducers. One implementation on purpose: the two
 * surfaces disagreeing about which row an observation completes is precisely
 * the drift that left native-MCP tool calls unrendered.
 */

/** The subset of an SSE tool frame needed to find the row it updates. */
export interface ToolFrame {
	tool_call_id?: string;
	tool_name?: string;
	subtask_id?: number;
}

/** The subset of an accumulated chunk the matcher reads. Structural so both
 *  the package's `AccumulatedChunk` and the app's `StreamingChunk` satisfy it. */
export interface MatchableToolChunk {
	type: string;
	toolName?: string;
	toolCallId?: string;
	subtaskId?: number;
}

/**
 * Locate the tool chunk a planned/executing/observation frame belongs to.
 *
 * An id-bearing frame matches ONLY by id. A turn can run several calls of the
 * same tool in one batch (native-MCP turns do this routinely — three
 * `get_profiles` calls in one message), and every one of them is a distinct
 * row: falling back to the name there would fold them into a single row on the
 * planned frame and complete the wrong row on the observation. A miss means
 * "no row for this call yet", which is what the planned handler needs to hear
 * to create one.
 *
 * Frames from paths that carry no id keep the historical behaviour: the most
 * recent same-name row, scoped to the frame's subtask when it has one.
 */
export function findToolChunkIndex<T extends MatchableToolChunk>(
	chunks: T[],
	frame: ToolFrame,
): number {
	if (frame.tool_call_id) {
		return chunks.findIndex(
			(c) => c.type === "tool" && c.toolCallId === frame.tool_call_id,
		);
	}
	for (let i = chunks.length - 1; i >= 0; i--) {
		const chunk = chunks[i];
		if (
			chunk.type === "tool" &&
			chunk.toolName === frame.tool_name &&
			(frame.subtask_id === undefined || chunk.subtaskId === frame.subtask_id)
		) {
			return i;
		}
	}
	return -1;
}
