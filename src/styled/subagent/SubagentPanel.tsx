import type { Event, EventStatus, StreamingChunk } from "../../types";
import { convertChunkToEvent } from "../EventTimeline";
import { Timeline, type TimelineItemData } from "../Timeline";
import { TimelineRow } from "../TimelineRow";

export interface SubagentPanelProps {
	chunk: StreamingChunk;
}

/**
 * Convert an LLM-facing handle ("verify_test_specialist") into a human label
 * ("Verify Test Specialist"). Falls back to the raw handle if it doesn't
 * look like a slug.
 */
function humanizeHandle(handle: string): string {
	if (!handle) return "Sub-assistant";
	return handle
		.split(/[_-]+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

/**
 * Renders a single sub-assistant dispatch as one row in a `Timeline` —
 * label + description + duration + chevron — matching plan subtasks and
 * multi-agent rows. Nested chunks (thinking/tool/observation/sub-assistant)
 * render as an indented `EventTimeline` underneath.
 */
export function SubagentPanel({ chunk }: SubagentPanelProps) {
	const data = chunk.subagentData;
	if (!data) return null;

	const status: EventStatus =
		data.status === "running"
			? "running"
			: data.status === "completed"
				? "completed"
				: data.status === "failed"
					? "failed"
					: "pending";

	const nestedEvents: Event[] = (data.nestedChunks ?? [])
		.map((c, i) => convertChunkToEvent(c, i))
		.filter((e): e is Event => e !== null);

	// Append the assistant's final answer as a thinking-style event so it
	// renders with the same content treatment as other reasoning output.
	if (data.result && data.result.trim().length > 0) {
		nestedEvents.push({
			id: `result-${data.subagentId}`,
			type: "thinking",
			status: data.status === "failed" ? "failed" : "completed",
			content: data.result,
		});
	}

	const items: TimelineItemData[] = [
		{
			id: data.subagentId,
			status,
			content: (
				<TimelineRow
					label={humanizeHandle(data.subagentType)}
					description={data.description || undefined}
					durationSeconds={data.durationMs != null ? data.durationMs / 1000 : undefined}
					isFailed={data.status === "failed"}
					defaultExpanded={data.status === "running"}
					nestedEvents={nestedEvents}
				/>
			),
		},
	];

	return <Timeline items={items} badgeSize={20} />;
}
