import { cn } from "../utils/cn";
import { Timeline, type TimelineItemData } from "./Timeline";
import { TimelineRow } from "./TimelineRow";
import type { PlanData, StreamingChunk, Event, EventStatus, SubTaskData } from "../types";

/**
 * Internal tools that should be hidden from users — kept in sync with
 * EventTimeline.INTERNAL_TOOLS. `tool_search` is the deferred-tool
 * discovery meta-tool, an implementation detail users shouldn't see.
 */
const INTERNAL_TOOLS = ["create_plan", "tool_search", "unknown"];

function isInternalTool(toolName?: string): boolean {
  if (!toolName) return false;
  return INTERNAL_TOOLS.includes(toolName.toLowerCase().trim());
}

/**
 * Convert streaming chunks to Events for a specific subtask
 */
function convertChunksToEvents(chunks: StreamingChunk[]): Event[] {
  const events: Event[] = [];

  chunks.forEach((chunk, index) => {
    if (chunk.type === "thinking") {
      if (!chunk.content || chunk.content.trim().length === 0) return;

      events.push({
        id: `thinking-${index}`,
        type: "thinking",
        status: "completed",
        content: chunk.content,
      });
    } else if (chunk.type === "tool") {
      if (isInternalTool(chunk.toolName)) return;

      const status: EventStatus =
        chunk.status === "executing"
          ? "running"
          : chunk.status === "completed"
            ? "completed"
            : "pending";

      events.push({
        id: `tool-${index}`,
        type: "tool",
        status,
        toolName: chunk.toolName || "Unknown Tool",
        toolDescription: chunk.toolDescription,
      });
    }
  });

  return events;
}

interface SubtaskContentProps {
  subtask: SubTaskData;
  executionChunks?: StreamingChunk[];
}

function SubtaskContent({ subtask, executionChunks = [] }: SubtaskContentProps) {
  const isFailed = subtask.status === "failed";
  const isCompleted = subtask.status === "completed";
  const events = convertChunksToEvents(executionChunks);

  return (
    <TimelineRow
      label={subtask.description}
      description={isFailed ? subtask.error : undefined}
      durationSeconds={isCompleted ? subtask.execution_time : undefined}
      isFailed={isFailed}
      defaultExpanded={subtask.status === "running"}
      nestedEvents={events}
    />
  );
}

export interface PlanTimelineProps {
  plan: PlanData;
  streamingChunks?: StreamingChunk[];
  className?: string;
}

/**
 * Minimal timeline for Plan & Execute mode.
 * Matches in-house style: simple "Plan:" header + inline text rows.
 */
export function PlanTimeline({
  plan,
  streamingChunks = [],
  className,
}: PlanTimelineProps) {
  // Convert subtasks to timeline items
  const timelineItems: TimelineItemData[] = plan.subtasks.map((subtask) => {
    const subtaskChunks = streamingChunks.filter(
      (chunk) => chunk.subtaskId === subtask.id
    );

    const status: EventStatus =
      subtask.status === "running"
        ? "running"
        : subtask.status === "completed"
          ? "completed"
          : subtask.status === "failed"
            ? "failed"
            : "pending";

    return {
      id: String(subtask.id),
      status,
      content: <SubtaskContent subtask={subtask} executionChunks={subtaskChunks} />,
    };
  });

  return (
    <div className={cn("space-y-2", className)}>
      {/* Simple header */}
      <span className="text-sm text-[var(--chat-text-subtle)]">Plan:</span>

      {/* Subtask timeline */}
      <Timeline items={timelineItems} badgeSize={20} />
    </div>
  );
}
