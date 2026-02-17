import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../utils/cn";
import { Timeline, type TimelineItemData } from "./Timeline";
import { EventTimeline } from "./EventTimeline";
import type { PlanData, StreamingChunk, Event, EventStatus, SubTaskData } from "../types";

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

/**
 * Minimal inline content for each subtask — description + time, no card/border.
 */
function SubtaskContent({ subtask, executionChunks = [] }: SubtaskContentProps) {
  const [isExpanded, setIsExpanded] = useState(subtask.status === "running");
  const isRunning = subtask.status === "running";
  const isFailed = subtask.status === "failed";
  const isCompleted = subtask.status === "completed";

  // Auto-expand when running
  if (isRunning && !isExpanded) {
    setIsExpanded(true);
  }

  const hasExecutionDetails = executionChunks.length > 0;
  const events = convertChunksToEvents(executionChunks);

  return (
    <div className="flex-1 min-w-0">
      {/* Single row: description + execution time + expand chevron */}
      <div
        onClick={() => hasExecutionDetails && setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 min-w-0",
          hasExecutionDetails && "cursor-pointer"
        )}
      >
        <span
          className={cn(
            "text-sm font-medium truncate",
            isFailed ? "text-red-500" : "text-black/85"
          )}
        >
          {subtask.description}
        </span>

        {/* Error inline */}
        {isFailed && subtask.error && (
          <span className="text-sm text-red-500 truncate flex-1">
            {subtask.error}
          </span>
        )}

        {/* Execution time inline (subtle, like "1.2s") */}
        {isCompleted && subtask.execution_time != null && subtask.execution_time > 0 && (
          <span className="text-xs text-black/40 shrink-0 tabular-nums">
            {subtask.execution_time.toFixed(1)}s
          </span>
        )}

        {/* Expand indicator */}
        {hasExecutionDetails && (
          <span className="text-black/40 shrink-0 flex items-center">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>

      {/* Nested execution details */}
      {hasExecutionDetails && isExpanded && (
        <div className="mt-2 pl-2">
          <EventTimeline events={events} />
        </div>
      )}
    </div>
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
      <span className="text-sm text-black/50">Plan:</span>

      {/* Subtask timeline */}
      <Timeline items={timelineItems} badgeSize={20} />
    </div>
  );
}
