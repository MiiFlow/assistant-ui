import { useState, useMemo, useEffect, useRef } from "react";
import {
  Sparkle, Wrench, ListTodo,
  Users, Zap, Terminal, FileText, Globe, Search, GitBranch, Loader2,
} from "lucide-react";
import { cn } from "../utils/cn";
import { injectBeamerKeyframes, beamerBarStyle } from "../utils/beamer";
import { EventTimeline, convertChunkToEvent } from "./EventTimeline";
import { PlanTimeline } from "./PlanTimeline";
import { Timeline, type TimelineItemData } from "./Timeline";
import {
  ClaudeToolPreview, FileOperationPreview, SearchResultsView,
  SubagentPanel, TerminalOutput, WebOperationPreview,
} from "./claude-sdk";
import type { StreamingChunk, PlanData, Event, SubagentInfo } from "../types";

/**
 * Hook for live duration counter
 */
function useLiveStreamDuration(isStreaming: boolean): string {
  const startTimeRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (isStreaming) {
      if (startTimeRef.current === null) startTimeRef.current = Date.now();
      const interval = setInterval(() => {
        if (startTimeRef.current !== null) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
      setElapsed(0);
    }
  }, [isStreaming]);

  return `${elapsed}`;
}

function hasClaudeSdkChunks(chunks: StreamingChunk[]): boolean {
  return chunks.some((c) =>
    c.orchestrator === "claude_agent_sdk" || c.type === "subagent" ||
    c.type === "file_operation" || c.type === "terminal" ||
    c.type === "search_results" || c.type === "web_operation" ||
    c.type === "claude_text" || c.type === "claude_thinking"
  );
}

function hasParallelExecutionChunks(chunks: StreamingChunk[]): boolean {
  return chunks.some((c) =>
    c.type === "wave_start" || c.type === "wave_complete" ||
    c.type === "parallel_subtask_start" || c.type === "parallel_subtask_complete" || c.isParallel
  );
}

function getWaveExecutionStatus(chunks: StreamingChunk[]) {
  const waveStartChunks = chunks.filter((c) => c.type === "wave_start" && c.waveData);
  if (waveStartChunks.length === 0) return null;

  const lastWaveStart = waveStartChunks[waveStartChunks.length - 1];
  const currentWave = lastWaveStart.waveData?.waveNumber ?? 0;
  const totalWaves = lastWaveStart.waveData?.totalWaves ?? 1;
  const parallelCount = lastWaveStart.waveData?.parallelCount ?? 0;

  const activeSubtasks: number[] = [];
  const completedSubtasks: number[] = [];

  chunks.forEach((c) => {
    if (c.type === "parallel_subtask_start" && c.waveNumber === currentWave && c.subtaskId !== undefined) {
      if (!completedSubtasks.includes(c.subtaskId)) activeSubtasks.push(c.subtaskId);
    }
    if (c.type === "parallel_subtask_complete" && c.waveNumber === currentWave && c.subtaskId !== undefined) {
      completedSubtasks.push(c.subtaskId);
      const idx = activeSubtasks.indexOf(c.subtaskId);
      if (idx >= 0) activeSubtasks.splice(idx, 1);
    }
  });

  return { currentWave, totalWaves, parallelCount, activeSubtasks, completedSubtasks };
}

function hasMultiAgentChunks(chunks: StreamingChunk[]): boolean {
  return chunks.some((c) =>
    c.type === "multi_agent_planning" || c.type === "multi_agent_planning_complete" ||
    c.type === "subagent_start" || c.type === "subagent_complete" ||
    c.type === "subagent_failed" || c.type === "synthesis" || c.isMultiAgent
  );
}

function getSubagentAllocations(chunks: StreamingChunk[]): { name: string; focus: string; query?: string }[] {
  const planningChunk = chunks.find((c) =>
    (c.type === "multi_agent_planning" || c.type === "multi_agent_planning_complete") && c.subagentAllocations
  );
  return planningChunk?.subagentAllocations || [];
}

function getMultiAgentStatus(chunks: StreamingChunk[]) {
  const subagents = new Map<string, SubagentInfo>();
  let isSynthesizing = false;

  getSubagentAllocations(chunks).forEach((alloc) => {
    subagents.set(alloc.name, { name: alloc.name, task: alloc.query || alloc.focus, status: "pending" });
  });

  const statusOrder: Record<string, number> = { pending: 0, running: 1, completed: 2, failed: 2 };

  chunks.forEach((c) => {
    if (c.subagentInfo?.name) {
      const key = c.subagentInfo.id || c.subagentInfo.name;
      const existing = subagents.get(key);
      if (!existing || (statusOrder[c.subagentInfo.status] ?? 0) >= (statusOrder[existing.status] ?? 0)) {
        subagents.set(key, c.subagentInfo);
      }
    }
    if (c.type === "synthesis") isSynthesizing = true;
  });

  const list = [...subagents.values()];
  return {
    subagents,
    running: list.filter((s) => s.status === "running").length,
    completed: list.filter((s) => s.status === "completed").length,
    failed: list.filter((s) => s.status === "failed").length,
    pending: list.filter((s) => s.status === "pending").length,
    isSynthesizing,
  };
}

function convertTimelineToChunks(timeline: any[]): StreamingChunk[] {
  const chunks: StreamingChunk[] = [];
  timeline.forEach((item) => {
    if (item.type === "thought" && item.thought) {
      chunks.push({ type: "thinking", content: item.thought, subtaskId: item.subtask_id });
    } else if (item.type === "tool") {
      chunks.push({ type: "tool", content: "", toolName: item.tool || "Unknown Tool", toolDescription: item.tool_description, status: "completed", subtaskId: item.subtask_id });
      if (item.observation) {
        chunks.push({ type: "observation", content: item.observation, toolName: item.tool || "Unknown Tool", success: true, subtaskId: item.subtask_id });
      }
    }
  });
  return chunks;
}

function MultiAgentStatusPanel({ chunks }: { chunks: StreamingChunk[] }) {
  const status = getMultiAgentStatus(chunks);
  const subagentList = [...status.subagents.values()];

  if (subagentList.length === 0) {
    const isPlanning = chunks.some((c) => c.type === "multi_agent_planning");
    const allocations = getSubagentAllocations(chunks);

    if (allocations.length > 0) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Allocating agents: {allocations.map((a) => a.name).join(", ")}</span>
        </div>
      );
    }
    if (isPlanning) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Planning agent allocation...</span>
        </div>
      );
    }
    return null;
  }

  const items: TimelineItemData[] = subagentList.map((agent, index) => ({
    id: agent.id || `agent-${index}`,
    status: agent.status === "running" ? "running" : agent.status === "completed" ? "completed" : agent.status === "failed" ? "failed" : "pending",
    content: (
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-medium">{agent.name}</span>
        <span className={cn("text-sm flex-1 truncate", agent.status === "failed" ? "text-red-500" : "text-gray-500")}>
          {agent.status === "failed" && agent.error ? agent.error : agent.task}
        </span>
        {agent.status === "completed" && agent.executionTime != null && (
          <span className="text-xs text-gray-400 shrink-0">{agent.executionTime.toFixed(1)}s</span>
        )}
      </div>
    ),
  }));

  return (
    <div className="space-y-2">
      <span className="text-sm text-gray-500">{status.running === 0 ? "Agents:" : "Running agents:"}</span>
      <Timeline items={items} badgeSize={16} />
      {status.isSynthesizing && (
        <div className="flex items-center gap-2">
          <Sparkle size={14} className="text-gray-500" />
          <span className="text-sm text-gray-500">Synthesizing results...</span>
        </div>
      )}
    </div>
  );
}

function ClaudeSdkChunksRenderer({ chunks }: { chunks: StreamingChunk[] }) {
  return (
    <div className="space-y-2">
      {chunks.map((chunk, index) => {
        if (chunk.type === "subagent" && chunk.subagentData) return <SubagentPanel key={`subagent-${chunk.subagentData.subagentId}-${index}`} chunk={chunk} />;
        if (chunk.type === "file_operation" && chunk.fileOperationData) return <FileOperationPreview key={`file-op-${chunk.fileOperationData.toolUseId}-${index}`} chunk={chunk} />;
        if (chunk.type === "terminal" && chunk.terminalData) return <TerminalOutput key={`terminal-${chunk.terminalData.toolUseId}-${index}`} chunk={chunk} />;
        if (chunk.type === "search_results" && chunk.searchResultsData) return <SearchResultsView key={`search-${chunk.searchResultsData.toolUseId}-${index}`} chunk={chunk} />;
        if (chunk.type === "web_operation" && chunk.webOperationData) return <WebOperationPreview key={`web-op-${chunk.webOperationData.toolUseId}-${index}`} chunk={chunk} />;
        if (chunk.claudeToolData) return <ClaudeToolPreview key={`claude-tool-${chunk.claudeToolData.toolUseId}-${index}`} chunk={chunk} />;
        return null;
      })}
    </div>
  );
}

export interface ReasoningPanelProps {
  /** Whether currently streaming */
  isStreaming?: boolean;
  /** Streaming chunks */
  chunks?: StreamingChunk[];
  /** Execution plan for Plan & Execute mode */
  plan?: PlanData;
  /** Execution timeline (completed messages) */
  executionTimeline?: any[];
  /** User message timestamp for duration calculation */
  userMessageTimestamp?: number;
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
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(1)}s`;
}

export function ReasoningPanel({
  isStreaming = false,
  chunks = [],
  plan,
  executionTimeline = [],
  userMessageTimestamp,
  executionTime,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  className,
}: ReasoningPanelProps) {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const liveElapsed = useLiveStreamDuration(isStreaming);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { injectBeamerKeyframes(containerRef.current); }, []);

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

  // Convert timeline to Events for completed messages
  const completedEvents = useMemo(() => {
    if (!isStreaming && (executionTimeline.length > 0 || chunks.length > 0)) {
      return chunks
        .map((chunk, index) => convertChunkToEvent(chunk, index))
        .filter((event): event is Event => event !== null);
    }
    return [];
  }, [isStreaming, executionTimeline, chunks]);

  // Convert timeline to chunks for PlanTimeline
  const completedChunks = useMemo((): StreamingChunk[] => {
    if (!isStreaming && executionTimeline.length > 0) return convertTimelineToChunks(executionTimeline);
    return [];
  }, [isStreaming, executionTimeline]);

  // Aggregate plan data from planning chunks
  const aggregatedPlanData = useMemo(() => {
    if (!isStreaming) return null;

    const planningChunk = chunks.find((c) => c.planData !== undefined);
    if (!planningChunk?.planData) return null;

    const planClone = { ...planningChunk.planData };
    const subtasks = [...(planClone.subtasks || [])];
    let completedCount = 0;
    let failedCount = 0;

    chunks.forEach((chunk) => {
      if (chunk.type === "parallel_subtask_start" && chunk.subtaskId !== undefined) {
        const idx = subtasks.findIndex((st) => String(st.id) === String(chunk.subtaskId));
        if (idx !== -1) subtasks[idx] = { ...subtasks[idx], status: "running" };
      } else if (chunk.type === "parallel_subtask_complete" && chunk.subtaskId !== undefined) {
        const idx = subtasks.findIndex((st) => String(st.id) === String(chunk.subtaskId));
        if (idx !== -1) {
          const st = { ...subtasks[idx] };
          if (chunk.parallelSubtaskData?.success === false || chunk.success === false) {
            st.status = "failed"; st.error = chunk.parallelSubtaskData?.error; failedCount++;
          } else {
            st.status = "completed"; st.result = chunk.parallelSubtaskData?.result;
            st.execution_time = chunk.parallelSubtaskData?.executionTime; completedCount++;
          }
          subtasks[idx] = st;
        }
      } else if (chunk.type === "subtask" && chunk.subtaskId !== undefined) {
        const idx = subtasks.findIndex((st) => String(st.id) === String(chunk.subtaskId));
        if (idx !== -1) {
          const st = { ...subtasks[idx] };
          if (chunk.content.includes("✓ Completed")) {
            st.status = "completed";
            if (chunk.subtaskData?.execution_time) st.execution_time = chunk.subtaskData.execution_time;
            completedCount++;
          } else if (chunk.content.includes("✗ Failed")) {
            st.status = "failed";
            const m = chunk.content.match(/✗ Failed: (.*)/);
            if (m) st.error = m[1];
            failedCount++;
          } else if (chunk.content.includes("→ **Subtask")) {
            st.status = "running";
          }
          subtasks[idx] = st;
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
    if (!isStreaming) {
      if (plan?.subtasks) return plan.subtasks.reduce((sum, st) => sum + (st.execution_time || 0), 0);
      if (executionTimeline.length > 0) {
        const lastEvent = executionTimeline[executionTimeline.length - 1];
        if (userMessageTimestamp && lastEvent.timestamp) return lastEvent.timestamp - userMessageTimestamp;
        if (executionTimeline.length > 1) {
          const firstEvent = executionTimeline[0];
          if (firstEvent.timestamp && lastEvent.timestamp) return lastEvent.timestamp - firstEvent.timestamp;
        }
      }
    }
    return executionTime || 0;
  }, [isStreaming, plan, executionTimeline, userMessageTimestamp, executionTime]);

  // Don't render if no content
  if (!isStreaming) {
    const hasContent = plan || executionTimeline.length > 0 || chunks.length > 0;
    if (!hasContent) return null;
    if (hasContent && completedEvents.length === 0 && !plan && executionTimeline.length === 0) return null;
  }

  // Detect modes
  const lastChunk = chunks.length > 0 ? chunks[chunks.length - 1] : null;
  const isToolAction = lastChunk?.type === "tool" || !!lastChunk?.toolName;
  const isPlanningAction = lastChunk?.type === "planning";
  const isParallelMode = hasParallelExecutionChunks(chunks);
  const waveStatus = isParallelMode ? getWaveExecutionStatus(chunks) : null;
  const isClaudeSdkMode = hasClaudeSdkChunks(chunks);
  const isMultiAgentMode = hasMultiAgentChunks(chunks);
  const multiAgentStatus = isMultiAgentMode ? getMultiAgentStatus(chunks) : null;

  // Mode-specific label
  const getLabel = () => {
    if (!isStreaming && totalExecutionTime > 0) return `Thought for ${formatDuration(totalExecutionTime)}`;

    // Multi-agent mode
    if (isMultiAgentMode && multiAgentStatus) {
      const { running, completed, failed, isSynthesizing } = multiAgentStatus;
      if (isSynthesizing) return "Synthesizing results...";
      if (lastChunk?.type === "multi_agent_planning") return "Planning subagent allocation...";
      if (lastChunk?.type === "subagent_start" && lastChunk?.subagentInfo) return `${lastChunk.subagentInfo.name}: ${lastChunk.subagentInfo.task?.slice(0, 30) || "working"}...`;
      if (lastChunk?.type === "subagent_complete" && lastChunk?.subagentInfo) return `${lastChunk.subagentInfo.name} complete`;
      if (lastChunk?.type === "subagent_failed" && lastChunk?.subagentInfo) return `${lastChunk.subagentInfo.name} failed`;
      const total = running + completed + failed;
      if (running > 0) return `${running} subagent${running > 1 ? "s" : ""} running (${completed}/${total} done)`;
      if (total > 0) return `Multi-agent execution (${completed}/${total} complete)`;
    }

    // Claude SDK mode
    if (isClaudeSdkMode) {
      if (lastChunk?.type === "subagent" && lastChunk?.subagentData) return `${lastChunk.subagentData.subagentType}: ${lastChunk.subagentData.description}`;
      if (lastChunk?.type === "file_operation" && lastChunk?.fileOperationData) {
        const op = lastChunk.fileOperationData.operation;
        const file = lastChunk.fileOperationData.filePath.split("/").pop();
        return `${op === "read" ? "Reading" : op === "edit" ? "Editing" : "Writing"} ${file}`;
      }
      if (lastChunk?.type === "terminal" && lastChunk?.terminalData) {
        const cmd = lastChunk.terminalData.command;
        return cmd.length > 40 ? `$ ${cmd.slice(0, 37)}...` : `$ ${cmd}`;
      }
      if (lastChunk?.type === "search_results" && lastChunk?.searchResultsData) return `${lastChunk.searchResultsData.tool}: ${lastChunk.searchResultsData.pattern}`;
      if (lastChunk?.type === "web_operation" && lastChunk?.webOperationData) {
        return lastChunk.webOperationData.operation === "search"
          ? `Searching: ${lastChunk.webOperationData.query}`
          : `Fetching: ${lastChunk.webOperationData.url?.slice(0, 40)}...`;
      }
    }

    // Parallel mode
    if (isParallelMode && waveStatus) {
      const { currentWave, totalWaves, parallelCount, activeSubtasks, completedSubtasks } = waveStatus;
      if (lastChunk?.type === "wave_start") return `Wave ${currentWave + 1}/${totalWaves}: ${parallelCount} parallel subtasks`;
      if (lastChunk?.type === "wave_complete") return `Wave ${currentWave + 1} complete (${completedSubtasks.length} done)`;
      if (lastChunk?.type === "parallel_subtask_start" && lastChunk?.parallelSubtaskData?.description) {
        const desc = lastChunk.parallelSubtaskData.description;
        return desc.length > 40 ? `${desc.slice(0, 37)}...` : desc;
      }
      if (activeSubtasks.length > 0) return `Wave ${currentWave + 1}/${totalWaves}: ${activeSubtasks.length} running...`;
      return `Parallel execution (Wave ${currentWave + 1}/${totalWaves})`;
    }

    // Default
    if (lastChunk?.toolDescription) return lastChunk.toolDescription;
    if (lastChunk?.toolName) return lastChunk.toolName;
    switch (lastChunk?.type) {
      case "planning": return "Planning...";
      case "thinking": return "Thinking...";
      case "tool": return lastChunk.toolName || "Using tool...";
      case "subtask": return `Executing subtask ${lastChunk.subtaskId || ""}...`;
      default: return "Processing...";
    }
  };

  // Mode-specific icon
  const getIcon = () => {
    if (isMultiAgentMode) return <Users size={14} />;
    if (isClaudeSdkMode) {
      if (lastChunk?.type === "subagent") return <GitBranch size={14} />;
      if (lastChunk?.type === "file_operation") return <FileText size={14} />;
      if (lastChunk?.type === "terminal") return <Terminal size={14} />;
      if (lastChunk?.type === "search_results") return <Search size={14} />;
      if (lastChunk?.type === "web_operation") return <Globe size={14} />;
      return <Sparkle size={14} />;
    }
    if (isParallelMode) return <Zap size={14} />;
    if (isToolAction) return <Wrench size={14} />;
    if (isPlanningAction) return <ListTodo size={14} />;
    return <Sparkle size={14} />;
  };

  // Determine what to show expanded
  const shouldShowPlanTimeline = (planData: PlanData | null | undefined) => {
    return planData?.subtasks && planData.subtasks.length >= 2;
  };

  const activePlan = isStreaming ? aggregatedPlanData : plan;
  const showPlanTimeline = shouldShowPlanTimeline(activePlan);

  return (
    <div ref={containerRef} className={cn("max-w-full", className)}>
      {/* Clickable header: icon + label + optional timer - matches on-platform MUI approach */}
      <div
        onClick={() => setExpanded(!isExpanded)}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 6px",
          overflow: "hidden",
          borderRadius: 8,
          cursor: "pointer",
          transition: "opacity 0.2s",
          ...(!isStreaming && { opacity: 0.6 }),
        }}
      >
        {isStreaming && <div style={beamerBarStyle} />}
        <span className={cn("flex items-center text-gray-500")}>
          {getIcon()}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            isStreaming
              ? "bg-gradient-to-r from-gray-400 via-gray-500 to-gray-400 bg-clip-text text-transparent"
              : "text-[var(--chat-text-subtle)]"
          )}
        >
          {getLabel()}
        </span>
        {isStreaming && parseInt(liveElapsed) > 0 && (
          <span className="text-gray-500 font-medium tabular-nums text-sm">{liveElapsed}s</span>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 animate-fade-in">
          {isStreaming ? (
            isMultiAgentMode ? (
              <MultiAgentStatusPanel chunks={chunks} />
            ) : isClaudeSdkMode ? (
              <ClaudeSdkChunksRenderer chunks={chunks} />
            ) : showPlanTimeline && activePlan ? (
              <PlanTimeline plan={activePlan} streamingChunks={chunks} />
            ) : aggregatedPlanData?.subtasks?.length === 1 ? (
              <EventTimeline events={streamingEvents} />
            ) : aggregatedPlanData?.subtasks?.length === 0 ? null : (
              <EventTimeline events={streamingEvents} />
            )
          ) : (
            // Completed mode
            plan ? (
              plan.subtasks?.length === 0 ? null :
              plan.subtasks?.length === 1 ? (
                <EventTimeline events={completedEvents} />
              ) : (
                <PlanTimeline plan={plan} streamingChunks={completedChunks} />
              )
            ) : (
              <EventTimeline events={completedEvents} />
            )
          )}
        </div>
      )}
    </div>
  );
}
