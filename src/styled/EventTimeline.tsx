import { Timeline, type TimelineItemData } from "./Timeline";
import { EventContent } from "./EventContent";
import type { Event, EventStatus, StreamingChunk } from "../types";

/**
 * Internal tools that should be hidden from users
 */
const INTERNAL_TOOLS = ["create_plan", "unknown"];

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

  // Don't render observation chunks separately
  return null;
}

/**
 * Convert timeline items (from metadata) to Events
 */
export function convertTimelineToEvents(timeline: Array<Record<string, unknown>>): Event[] {
  const events: Event[] = [];

  timeline.forEach((item, index) => {
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
      });
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
      });
    }
  });

  return events;
}

export interface EventTimelineProps {
  events: Event[];
  isStreaming?: boolean;
  className?: string;
}

/**
 * Unified event timeline component
 * Displays thinking, tool execution, and observation events
 */
export function EventTimeline({ events, className }: EventTimelineProps) {
  if (events.length === 0) {
    return null;
  }

  // Convert events to timeline items
  const timelineItems: TimelineItemData[] = events.map((event) => ({
    id: event.id,
    status: event.status,
    content: <EventContent event={event} isRunning={event.status === "running"} />,
  }));

  return <Timeline items={timelineItems} badgeSize={20} className={className} />;
}
