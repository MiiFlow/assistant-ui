import { useState, useMemo } from "react";
import { Sparkle, Wrench, ListTodo, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../utils/cn";
import { EventTimeline, convertChunkToEvent } from "./EventTimeline";
import { PlanTimeline } from "./PlanTimeline";
import type { StreamingChunk, PlanData, Event } from "../types";

export interface ReasoningPanelProps {
  /** Whether currently streaming */
  isStreaming?: boolean;
  /** Streaming chunks (thinking, tool calls, etc.) */
  chunks?: StreamingChunk[];
  /** Execution plan for Plan & Execute mode */
  plan?: PlanData;
  /** Total execution time in seconds */
  executionTime?: number;
  /** Whether expanded by default */
  defaultExpanded?: boolean;
  /** Controlled expanded state */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Additional class names */
  className?: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }
  return `${seconds.toFixed(1)}s`;
}

/**
 * Collapsible panel showing AI reasoning, tool execution, and planning
 * Matches main app's ReasoningPanel functionality
 */
export function ReasoningPanel({
  isStreaming = false,
  chunks = [],
  plan,
  executionTime,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  className,
}: ReasoningPanelProps) {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

  const isExpanded = controlledExpanded ?? localExpanded;
  const setExpanded = (value: boolean) => {
    setLocalExpanded(value);
    onExpandedChange?.(value);
  };

  // Convert streaming chunks to Events
  const streamingEvents = useMemo(() => {
    if (isStreaming) {
      return chunks
        .map((chunk, index) => convertChunkToEvent(chunk, index))
        .filter((event): event is Event => event !== null);
    }
    return [];
  }, [isStreaming, chunks]);

  // Aggregate plan data from planning chunks and subtask chunks
  const aggregatedPlanData = useMemo(() => {
    if (!isStreaming) return null;

    // Find the chunk with plan data
    const planningChunk = chunks.find((c) => c.planData !== undefined);
    if (!planningChunk?.planData) {
      return null;
    }

    // Clone the plan data
    const planClone = { ...planningChunk.planData };
    const subtasks = [...(planClone.subtasks || [])];

    // Update subtask statuses from subtask chunks
    let completedCount = 0;
    let failedCount = 0;

    chunks.forEach((chunk) => {
      if (chunk.type === "subtask" && chunk.subtaskId !== undefined) {
        const subtaskIndex = subtasks.findIndex((st) => st.id === chunk.subtaskId);
        if (subtaskIndex !== -1) {
          const subtask = { ...subtasks[subtaskIndex] };

          if (chunk.content.includes("✓ Completed")) {
            subtask.status = "completed";
            if (chunk.subtaskData?.execution_time) {
              subtask.execution_time = chunk.subtaskData.execution_time;
            }
            completedCount++;
          } else if (chunk.content.includes("✗ Failed")) {
            subtask.status = "failed";
            const errorMatch = chunk.content.match(/✗ Failed: (.*)/);
            if (errorMatch) {
              subtask.error = errorMatch[1];
            }
            failedCount++;
          } else if (chunk.content.includes("→ **Subtask")) {
            subtask.status = "running";
          }

          subtasks[subtaskIndex] = subtask;
        }
      }
    });

    planClone.subtasks = subtasks;
    planClone.completed_subtasks = completedCount;
    planClone.failed_subtasks = failedCount;
    planClone.progress_percentage = (completedCount / planClone.total_subtasks) * 100;

    return planClone;
  }, [isStreaming, chunks]);

  // Calculate total execution time
  const totalExecutionTime = useMemo(() => {
    if (!isStreaming && plan?.subtasks) {
      return plan.subtasks.reduce((sum, st) => sum + (st.execution_time || 0), 0);
    }
    return executionTime || 0;
  }, [isStreaming, plan, executionTime]);

  // Don't render if no content
  if (!isStreaming && chunks.length === 0 && !plan) {
    return null;
  }

  // Get the last chunk for status display
  const lastChunk = chunks.length > 0 ? chunks[chunks.length - 1] : null;
  const isToolAction = lastChunk?.type === "tool" || lastChunk?.toolName;
  const isPlanningAction = lastChunk?.type === "planning";

  // Determine chip label
  const getChipLabel = () => {
    if (!isStreaming && totalExecutionTime > 0) {
      return `Thought for ${formatDuration(totalExecutionTime)}`;
    }

    if (lastChunk?.toolDescription) return lastChunk.toolDescription;
    if (lastChunk?.toolName) return lastChunk.toolName;

    switch (lastChunk?.type) {
      case "planning":
        return "Planning...";
      case "thinking":
        return "Thinking...";
      case "tool":
        return lastChunk.toolName || "Using tool...";
      case "subtask":
        return `Executing subtask ${lastChunk.subtaskId || ""}...`;
      default:
        return "Processing...";
    }
  };

  // Determine chip icon
  const getChipIcon = () => {
    if (isToolAction) {
      return <Wrench size={14} />;
    }
    if (isPlanningAction) {
      return <ListTodo size={14} />;
    }
    return <Sparkle size={14} />;
  };

  // Determine which timeline to show
  const shouldShowPlanTimeline = (planData: PlanData | null | undefined) => {
    if (!planData?.subtasks) return false;
    // Show plan timeline only for multi-step plans (2+ subtasks)
    return planData.subtasks.length >= 2;
  };

  const activePlan = isStreaming ? aggregatedPlanData : plan;
  const showPlanTimeline = shouldShowPlanTimeline(activePlan);

  return (
    <div className={cn("max-w-full", className)}>
      {/* Collapsible chip header */}
      <button
        onClick={() => setExpanded(!isExpanded)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5",
          "text-sm rounded-full",
          "bg-[var(--chat-panel-bg)] text-[var(--chat-text-subtle)]",
          "hover:bg-[var(--chat-panel-border)]",
          "transition-all duration-200",
          "cursor-pointer",
          isStreaming && "relative overflow-hidden",
          !isStreaming && "opacity-60 hover:opacity-100"
        )}
      >
        {/* Scanning animation for streaming */}
        {isStreaming && (
          <div className="absolute inset-0 animate-scanning bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        )}

        <span className="text-[var(--chat-text-subtle)] relative z-10">
          {getChipIcon()}
        </span>
        <span className="relative z-10">{getChipLabel()}</span>
        <span className="relative z-10 text-[var(--chat-text-subtle)]">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 animate-fade-in">
          {showPlanTimeline && activePlan ? (
            <PlanTimeline plan={activePlan} streamingChunks={chunks} />
          ) : (
            <EventTimeline events={streamingEvents} />
          )}
        </div>
      )}
    </div>
  );
}
