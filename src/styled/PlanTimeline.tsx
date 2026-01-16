import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../utils/cn";
import { Timeline, type TimelineItemData } from "./Timeline";
import { EventTimeline } from "./EventTimeline";
import type { PlanData, StreamingChunk, Event, EventStatus, SubTaskData } from "../types";

/**
 * Hook for live duration counter that updates every 100ms while running
 */
function useLiveDuration(isRunning: boolean): string {
  const startTimeRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (isRunning) {
      // Start the timer
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }

      const interval = setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsed((Date.now() - startTimeRef.current) / 1000);
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      // Reset when no longer running
      startTimeRef.current = null;
      setElapsed(0);
    }
  }, [isRunning]);

  return elapsed.toFixed(1);
}

/**
 * Convert streaming chunks to Events for a specific subtask
 */
function convertChunksToEvents(chunks: StreamingChunk[]): Event[] {
  const events: Event[] = [];

  chunks.forEach((chunk, index) => {
    if (chunk.type === "thinking") {
      if (!chunk.content || chunk.content.trim().length === 0) {
        return;
      }

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
 * Content component for each subtask
 */
function SubtaskContent({ subtask, executionChunks = [] }: SubtaskContentProps) {
  const [isExpanded, setIsExpanded] = useState(subtask.status === "running");
  const isRunning = subtask.status === "running";
  const liveElapsed = useLiveDuration(isRunning);

  // Auto-expand when running
  if (isRunning && !isExpanded) {
    setIsExpanded(true);
  }

  const hasExecutionDetails = executionChunks.length > 0;
  const events = convertChunksToEvents(executionChunks);

  return (
    <div className="flex-1 min-w-0">
      <div
        onClick={() => hasExecutionDetails && setIsExpanded(!isExpanded)}
        className={cn(
          "flex flex-col p-3 rounded relative overflow-hidden",
          "bg-black/[0.01] border border-[var(--chat-border)]",
          "transition-colors",
          hasExecutionDetails && "cursor-pointer hover:bg-black/[0.02] hover:border-black/[0.12]",
          isRunning && "border-indigo-200 bg-indigo-50/30"
        )}
      >
        {/* Animated gradient border for running state */}
        {isRunning && (
          <div className="absolute inset-0 rounded pointer-events-none">
            <div className="absolute -inset-[1px] rounded bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-indigo-500/20 animate-gradient-shift" />
          </div>
        )}

        {/* Description */}
        <div className="flex-1 min-w-0 relative">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[15px] font-medium text-[var(--chat-text)] leading-snug">
              {subtask.description}
            </span>
            {hasExecutionDetails && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex-shrink-0 p-0.5"
              >
                {isExpanded ? (
                  <ChevronUp size={14} className="text-[var(--chat-text-subtle)]" />
                ) : (
                  <ChevronDown size={14} className="text-[var(--chat-text-subtle)]" />
                )}
              </button>
            )}
          </div>

          {/* Status info */}
          <div className="flex items-center gap-1 mt-1">
            {isRunning && (
              <span className="text-xs text-indigo-600 font-medium tabular-nums">
                Running... {liveElapsed}s
              </span>
            )}
            {subtask.status === "completed" && subtask.execution_time && (
              <span className="text-xs text-green-600 font-medium">
                Completed in {subtask.execution_time.toFixed(2)}s
              </span>
            )}
            {subtask.status === "failed" && subtask.error && (
              <span className="text-xs text-red-600 font-medium">
                {subtask.error}
              </span>
            )}
          </div>
        </div>

        {/* Execution details */}
        {hasExecutionDetails && isExpanded && (
          <div className="mt-3 pl-2 border-l-2 border-[var(--chat-border)] relative">
            <EventTimeline events={events} />
          </div>
        )}
      </div>
    </div>
  );
}

export interface PlanTimelineProps {
  plan: PlanData;
  streamingChunks?: StreamingChunk[];
  className?: string;
}

/**
 * Timeline visualization for Plan & Execute mode
 * Shows plan with expandable subtasks
 */
export function PlanTimeline({
  plan,
  streamingChunks = [],
  className,
}: PlanTimelineProps) {
  const completedCount = plan.completed_subtasks || 0;
  const totalCount = plan.total_subtasks || plan.subtasks.length;
  const progressPct = plan.progress_percentage || (completedCount / totalCount) * 100;

  // Convert subtasks to timeline items
  const timelineItems: TimelineItemData[] = plan.subtasks.map((subtask) => {
    const subtaskChunks = streamingChunks.filter(
      (chunk) => chunk.subtaskId === subtask.id
    );

    // Map subtask status to EventStatus
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
    <div className={cn("space-y-3", className)}>
      {/* Progress header */}
      <div className="text-[15px] font-medium leading-snug">
        Plan: {completedCount}/{totalCount} completed ({Math.round(progressPct)}%)
      </div>

      {/* Subtask timeline */}
      <Timeline items={timelineItems} badgeSize={24} />
    </div>
  );
}
