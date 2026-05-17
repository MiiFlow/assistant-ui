import { Timeline, type TimelineItemData } from "./Timeline";
import { EventContent } from "./EventContent";
import type { Event, EventStatus, StreamingChunk } from "../types";

/**
 * Internal tools that should be hidden from users.
 *
 * `dispatch_assistant` is special: the call IS user-relevant, but it's
 * rendered as a nested SubagentPanel via the dedicated "subagent" event
 * type below. Hiding the raw tool-call chip avoids duplicate rendering of
 * the same dispatch in two visual styles.
 */
const INTERNAL_TOOLS = ["create_plan", "tool_search", "unknown", "dispatch_assistant"];

function isInternalTool(toolName?: string): boolean {
  if (!toolName) return false;
  return INTERNAL_TOOLS.includes(toolName.toLowerCase().trim());
}

/**
 * Convert StreamingChunk to Event format
 */
export function convertChunkToEvent(chunk: StreamingChunk, index: number): Event | null {
  // Filter out internal tools
  if (chunk.toolName && isInternalTool(chunk.toolName)) {
    return null;
  }

  if (chunk.type === "thinking") {
    // Skip empty thinking chunks
    if (!chunk.content || chunk.content.trim().length === 0) {
      return null;
    }

    return {
      id: `thinking-${index}`,
      type: "thinking",
      status: "completed",
      content: chunk.content,
    };
  }

  if (chunk.type === "planning") {
    // Skip empty planning chunks
    if (!chunk.content || chunk.content.trim().length === 0) {
      return null;
    }

    const isComplete = chunk.planData !== undefined || chunk.content.includes("✓ Created plan");

    return {
      id: `planning-${index}`,
      type: "planning",
      status: isComplete ? "completed" : "running",
      content: chunk.content,
      isComplete,
    };
  }

  if (chunk.type === "tool") {
    const status: EventStatus =
      chunk.status === "executing"
        ? "running"
        : chunk.status === "completed"
          ? "completed"
          : "pending";

    return {
      id: `tool-${index}`,
      type: "tool",
      status,
      toolName: chunk.toolName || "Unknown Tool",
      toolDescription: chunk.toolDescription,
    };
  }

  // Sub-assistant dispatch — render the SubagentPanel inline in the
  // timeline at the position the dispatch was issued. Skip if subagentData
  // is missing (defensive: should never happen for well-formed chunks).
  if (chunk.type === "subagent" && chunk.subagentData) {
    const status: EventStatus =
      chunk.subagentData.status === "running"
        ? "running"
        : chunk.subagentData.status === "completed"
          ? "completed"
          : chunk.subagentData.status === "failed"
            ? "failed"
            : "pending";

    return {
      id: `subagent-${chunk.subagentData.subagentId}-${index}`,
      type: "subagent",
      status,
      subagentData: chunk.subagentData,
    };
  }

  // Don't render observation chunks separately
  return null;
}

/**
 * Convert timeline items (from metadata) to Events.
 *
 * Computes pairwise `durationSeconds` from `item.timestamp` so completed
 * timelines can show per-step trace bars. Falls back to undefined when
 * timestamps are missing (e.g. tail events without a successor).
 */
export function convertTimelineToEvents(timeline: Array<Record<string, unknown>>): Event[] {
  const events: Event[] = [];
  const eventTimestamps: number[] = [];

  timeline.forEach((item, index) => {
    const ts = typeof item.timestamp === "number" ? item.timestamp : undefined;

    if (item.type === "thought") {
      const thought = item.thought as string | undefined;
      if (!thought || thought.trim().length === 0) {
        return;
      }

      events.push({
        id: `thought-${index}`,
        type: "thinking",
        status: "completed",
        content: thought,
        timestamp: ts,
      });
      eventTimestamps.push(ts ?? NaN);
    } else if (item.type === "tool") {
      const tool = (item.tool as string) || "Unknown Tool";
      if (isInternalTool(tool)) {
        return;
      }

      events.push({
        id: `tool-${index}`,
        type: "tool",
        status: "completed",
        toolName: tool,
        toolDescription: item.tool_description as string | undefined,
        timestamp: ts,
      });
      eventTimestamps.push(ts ?? NaN);
    }
  });

  // Pairwise duration: each event's duration = next event's timestamp - this one's.
  // The last event has no successor, so its duration is left undefined.
  for (let i = 0; i < events.length - 1; i++) {
    const cur = eventTimestamps[i];
    const next = eventTimestamps[i + 1];
    if (Number.isFinite(cur) && Number.isFinite(next) && next > cur) {
      const diff = next - cur;
      // Timestamps may be epoch ms or seconds; normalize to seconds.
      const seconds = diff > 1000 ? diff / 1000 : diff;
      if (seconds > 0 && seconds < 3600) {
        events[i].durationSeconds = seconds;
      }
    }
  }

  return events;
}

export interface EventTimelineProps {
  events: Event[];
  isStreaming?: boolean;
  className?: string;
}

function eventKind(event: Event): TimelineItemData["kind"] {
  switch (event.type) {
    case "thinking":
      return "thinking";
    case "planning":
      return "planning";
    case "tool":
      return "tool";
    case "observation":
      return "observation";
    case "subagent":
      return "subagent";
    default:
      return undefined;
  }
}

/**
 * Unified event timeline component
 * Displays thinking, tool execution, and observation events
 */
export function EventTimeline({ events, className }: EventTimelineProps) {
  if (events.length === 0) {
    return null;
  }

  // Max duration across this timeline drives the proportional micro-bar.
  const maxDurationSeconds = events.reduce(
    (max, e) => (e.durationSeconds && e.durationSeconds > max ? e.durationSeconds : max),
    0,
  );

  // Convert events to timeline items. Subagent rows own a nested timeline,
  // so the parent's running-state wash would read as a card around the
  // entire group — mark them `bare` to suppress it.
  const timelineItems: TimelineItemData[] = events.map((event) => ({
    id: event.id,
    status: event.status,
    kind: eventKind(event),
    content: (
      <EventContent
        event={event}
        isRunning={event.status === "running"}
        maxDurationSeconds={maxDurationSeconds}
      />
    ),
    bare: event.type === "subagent",
  }));

  return <Timeline items={timelineItems} badgeSize={20} className={className} />;
}
