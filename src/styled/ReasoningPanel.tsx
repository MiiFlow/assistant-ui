import {
	GitBranch,
	ListTodo,
	Sparkle,
	Users,
	Wrench,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScrollLock } from "../hooks/use-scroll-lock";
import type { Event, EventStatus, PlanData, StreamingChunk, SubagentInfo } from "../types";
import { beamerBarStyle, injectBeamerKeyframes } from "../utils/beamer";
import { cn } from "../utils/cn";
import { EventTimeline, convertChunkToEvent } from "./EventTimeline";
import { PlanTimeline } from "./PlanTimeline";
import { Timeline, type TimelineItemData } from "./Timeline";
import { TimelineRow } from "./TimelineRow";

/**
 * Hook for live duration counter
 */
function useLiveStreamDuration(isStreaming: boolean): { display: string; finalSeconds: number } {
	const startTimeRef = useRef<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const finalSecondsRef = useRef(0);

	useEffect(() => {
		if (isStreaming) {
			if (startTimeRef.current === null) startTimeRef.current = Date.now();
			const interval = setInterval(() => {
				if (startTimeRef.current !== null) {
					const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
					setElapsed(secs);
					finalSecondsRef.current = secs;
				}
			}, 1000);
			return () => clearInterval(interval);
		} else if (startTimeRef.current !== null) {
			// Streaming just ended — capture final elapsed time
			finalSecondsRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
			setElapsed(finalSecondsRef.current);
			startTimeRef.current = null;
		}
	}, [isStreaming]);

	return { display: `${elapsed}`, finalSeconds: finalSecondsRef.current };
}

function hasSubagentChunks(chunks: StreamingChunk[]): boolean {
	return chunks.some((c) => c.type === "subagent");
}

function hasParallelExecutionChunks(chunks: StreamingChunk[]): boolean {
	return chunks.some(
		(c) =>
			c.type === "wave_start" ||
			c.type === "wave_complete" ||
			c.type === "parallel_subtask_start" ||
			c.type === "parallel_subtask_complete" ||
			c.isParallel,
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
	return chunks.some(
		(c) =>
			c.type === "multi_agent_planning" ||
			c.type === "multi_agent_planning_complete" ||
			c.type === "subagent_start" ||
			c.type === "subagent_complete" ||
			c.type === "subagent_failed" ||
			c.type === "synthesis" ||
			c.isMultiAgent,
	);
}

function getSubagentAllocations(chunks: StreamingChunk[]): { name: string; focus: string; query?: string }[] {
	const planningChunk = chunks.find(
		(c) => (c.type === "multi_agent_planning" || c.type === "multi_agent_planning_complete") && c.subagentAllocations,
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

// Internal tools hidden from users — kept in sync with EventTimeline /
// PlanTimeline. tool_search is the deferred-tool discovery meta-tool.
// Tools hidden from user-facing labels and timeline rendering. `dispatch_assistant`
// is rendered as a SubagentPanel event inline (see EventTimeline.convertChunkToEvent),
// so the raw tool call should not also appear as a "dispatch_assistant: …" label.
const INTERNAL_TOOLS = new Set([
	"create_plan",
	"tool_search",
	"unknown",
	"dispatch_assistant",
]);

function convertTimelineToChunks(timeline: any[]): StreamingChunk[] {
	const chunks: StreamingChunk[] = [];
	timeline.forEach((item) => {
		if (item.type === "thought" && item.thought) {
			chunks.push({ type: "thinking", content: item.thought, subtaskId: item.subtask_id });
		} else if (item.type === "tool") {
			const toolName = (item.tool || "").toLowerCase().trim();
			if (INTERNAL_TOOLS.has(toolName)) return;

			chunks.push({
				type: "tool",
				content: "",
				toolName: item.tool || "Unknown Tool",
				toolDescription: item.tool_description,
				status: "completed",
				subtaskId: item.subtask_id,
			});
			if (item.observation) {
				chunks.push({
					type: "observation",
					content: item.observation,
					toolName: item.tool || "Unknown Tool",
					success: true,
					subtaskId: item.subtask_id,
				});
			}
		}
	});
	return chunks;
}

function MultiAgentStatusPanel({ chunks }: { chunks: StreamingChunk[] }) {
	const status = getMultiAgentStatus(chunks);
	const subagentList = [...status.subagents.values()];

	const items: TimelineItemData[] = [];

	if (subagentList.length === 0) {
		const allocations = getSubagentAllocations(chunks);
		const isPlanning = chunks.some((c) => c.type === "multi_agent_planning");

		if (allocations.length === 0 && !isPlanning) return null;

		items.push({
			id: "allocating",
			status: "running",
			content: (
				<TimelineRow
					label={allocations.length > 0 ? "Allocating agents" : "Planning agent allocation"}
					description={allocations.length > 0 ? allocations.map((a) => a.name).join(", ") : undefined}
				/>
			),
		});
	} else {
		subagentList.forEach((agent, index) => {
			const agentStatus: EventStatus =
				agent.status === "running"
					? "running"
					: agent.status === "completed"
						? "completed"
						: agent.status === "failed"
							? "failed"
							: "pending";

			items.push({
				id: agent.id || `agent-${index}`,
				status: agentStatus,
				content: (
					<TimelineRow
						label={agent.name}
						description={agent.status === "failed" && agent.error ? agent.error : agent.task}
						durationSeconds={agent.status === "completed" ? agent.executionTime : undefined}
						isFailed={agent.status === "failed"}
					/>
				),
			});
		});

		if (status.isSynthesizing) {
			items.push({
				id: "synthesis",
				status: "running",
				content: <TimelineRow label="Synthesizing results" />,
			});
		}
	}

	return <Timeline items={items} badgeSize={20} />;
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
	const { display: liveElapsed, finalSeconds: wallClockSeconds } = useLiveStreamDuration(isStreaming);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		injectBeamerKeyframes(containerRef.current);
	}, []);

	// Scroll lock: prevent viewport jump when expanding/collapsing
	const lockScroll = useScrollLock(containerRef, 300);

	const isExpanded = controlledExpanded ?? localExpanded;
	const setExpanded = useCallback(
		(value: boolean) => {
			lockScroll();
			setLocalExpanded(value);
			onExpandedChange?.(value);
		},
		[lockScroll, onExpandedChange],
	);

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
						st.status = "failed";
						st.error = chunk.parallelSubtaskData?.error;
						failedCount++;
					} else {
						st.status = "completed";
						st.result = chunk.parallelSubtaskData?.result;
						st.execution_time = chunk.parallelSubtaskData?.executionTime;
						completedCount++;
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
		// Explicit prop takes highest priority (persisted wall-clock from streaming)
		if (executionTime && executionTime > 0) return executionTime;

		if (!isStreaming) {
			if (plan?.subtasks) return plan.subtasks.reduce((sum, st) => sum + (st.execution_time || 0), 0);
			if (executionTimeline.length > 0) {
				const lastEvent = executionTimeline[executionTimeline.length - 1];
				if (userMessageTimestamp && lastEvent.timestamp) {
					const diff = lastEvent.timestamp - userMessageTimestamp;
					if (diff > 0) return diff;
				}
				if (executionTimeline.length > 1) {
					const firstEvent = executionTimeline[0];
					if (firstEvent.timestamp && lastEvent.timestamp) {
						const diff = lastEvent.timestamp - firstEvent.timestamp;
						if (diff > 0) return diff;
					}
				}
			}
		}
		return 0;
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
	const hasSubagent = hasSubagentChunks(chunks);
	const isMultiAgentMode = hasMultiAgentChunks(chunks);
	const multiAgentStatus = isMultiAgentMode ? getMultiAgentStatus(chunks) : null;

	// Mode-specific label
	const getLabel = () => {
		if (!isStreaming) {
			if (totalExecutionTime > 0) return `Thought for ${formatDuration(totalExecutionTime)}`;
			// Fallback: use wall-clock elapsed time tracked by the component
			if (wallClockSeconds > 0) return `Thought for ${formatDuration(wallClockSeconds)}`;
			if (chunks.length > 0) return "Thought for a few seconds";
			return "Thought for a few seconds";
		}

		// Multi-agent mode
		if (isMultiAgentMode && multiAgentStatus) {
			const { running, completed, failed, isSynthesizing } = multiAgentStatus;
			if (isSynthesizing) return "Synthesizing results...";
			if (lastChunk?.type === "multi_agent_planning") return "Planning subagent allocation...";
			if (lastChunk?.type === "subagent_start" && lastChunk?.subagentInfo)
				return `${lastChunk.subagentInfo.name}: ${lastChunk.subagentInfo.task?.slice(0, 30) || "working"}...`;
			if (lastChunk?.type === "subagent_complete" && lastChunk?.subagentInfo)
				return `${lastChunk.subagentInfo.name} complete`;
			if (lastChunk?.type === "subagent_failed" && lastChunk?.subagentInfo)
				return `${lastChunk.subagentInfo.name} failed`;
			const total = running + completed + failed;
			if (running > 0) return `${running} subagent${running > 1 ? "s" : ""} running (${completed}/${total} done)`;
			if (total > 0) return `Multi-agent execution (${completed}/${total} complete)`;
		}

		// Sub-assistant mode
		if (hasSubagent && lastChunk?.type === "subagent" && lastChunk?.subagentData)
			return `${lastChunk.subagentData.subagentType}: ${lastChunk.subagentData.description}`;

		// Parallel mode
		if (isParallelMode && waveStatus) {
			const { currentWave, totalWaves, parallelCount, activeSubtasks, completedSubtasks } = waveStatus;
			if (lastChunk?.type === "wave_start")
				return `Wave ${currentWave + 1}/${totalWaves}: ${parallelCount} parallel subtasks`;
			if (lastChunk?.type === "wave_complete")
				return `Wave ${currentWave + 1} complete (${completedSubtasks.length} done)`;
			if (lastChunk?.type === "parallel_subtask_start" && lastChunk?.parallelSubtaskData?.description) {
				const desc = lastChunk.parallelSubtaskData.description;
				return desc.length > 40 ? `${desc.slice(0, 37)}...` : desc;
			}
			if (activeSubtasks.length > 0)
				return `Wave ${currentWave + 1}/${totalWaves}: ${activeSubtasks.length} running...`;
			return `Parallel execution (Wave ${currentWave + 1}/${totalWaves})`;
		}

		// Default — but skip the internal tool_search meta-tool's labels so
		// users don't see "tool_search" or its description as live status.
		const lastToolName = lastChunk?.toolName?.toLowerCase().trim();
		const lastIsInternal = !!lastToolName && INTERNAL_TOOLS.has(lastToolName);
		if (!lastIsInternal && lastChunk?.toolDescription) return lastChunk.toolDescription;
		if (!lastIsInternal && lastChunk?.toolName) return lastChunk.toolName;
		switch (lastChunk?.type) {
			case "planning":
				return "Planning...";
			case "thinking":
				return "Thinking...";
			case "tool":
				if (lastIsInternal) return "Thinking...";
				return lastChunk.toolName || "Using tool...";
			case "subtask":
				return `Executing subtask ${lastChunk.subtaskId || ""}...`;
			case "observation":
				return "Analyzing results...";
			case "progress":
				return "Working...";
			case "wave_start":
				return `Starting parallel execution...`;
			case "wave_complete":
				return "Parallel wave complete";
			case "parallel_subtask_start":
				return `Running parallel subtask...`;
			case "parallel_subtask_complete":
				return "Parallel subtask complete";
			default:
				return "Thinking...";
		}
	};

	// Mode-specific icon
	const getIcon = () => {
		if (isMultiAgentMode) return <Users size={14} />;
		if (hasSubagent) return <GitBranch size={14} />;
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
				}}>
				{isStreaming && <div style={beamerBarStyle} />}
				<span className="flex items-center text-[var(--chat-text-subtle)]">
					{isStreaming ? getIcon() : <Sparkle size={14} />}
				</span>
				<span className="text-sm font-normal text-[var(--chat-text-subtle)]">
					{getLabel()}
				</span>
				{isStreaming && parseInt(liveElapsed) > 0 && (
					<span className="text-[var(--chat-text-subtle)] font-normal tabular-nums text-sm">
						{liveElapsed}s
					</span>
				)}
			</div>

			{isExpanded && (
				<div className="mt-3 animate-fade-in">
					{isStreaming ? (
						isMultiAgentMode ? (
							<MultiAgentStatusPanel chunks={chunks} />
						) : showPlanTimeline && activePlan ? (
							<PlanTimeline plan={activePlan} streamingChunks={chunks} />
						) : aggregatedPlanData?.subtasks?.length === 1 ? (
							<EventTimeline events={streamingEvents} />
						) : aggregatedPlanData?.subtasks?.length === 0 ? null : (
							<EventTimeline events={streamingEvents} />
						)
					) : // Completed mode
					plan ? (
						plan.subtasks?.length === 0 ? null : plan.subtasks?.length === 1 ? (
							<EventTimeline events={completedEvents} />
						) : (
							<PlanTimeline plan={plan} streamingChunks={completedChunks} />
						)
					) : (
						<EventTimeline events={completedEvents} />
					)}
				</div>
			)}
		</div>
	);
}
