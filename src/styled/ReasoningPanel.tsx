import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useScrollLock } from "../hooks/use-scroll-lock";
import type { Event, PlanData, StreamingChunk } from "../types";
import { injectBeamerKeyframes } from "../utils/beamer";
import { cn } from "../utils/cn";
import { EventTimeline, convertChunkToEvent } from "./EventTimeline";
import { PlanTimeline } from "./PlanTimeline";

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

// Internal tools hidden from users — kept in sync with EventTimeline /
// PlanTimeline. tool_search is the deferred-tool discovery meta-tool.
// `dispatch_assistant` is rendered as a SubagentPanel event inline (see
// EventTimeline.convertChunkToEvent), so the raw tool call should not also
// appear as a "dispatch_assistant: …" label.
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

export interface ReasoningPanelProps {
	/** Whether currently streaming */
	isStreaming?: boolean;
	/** Streaming chunks */
	chunks?: StreamingChunk[];
	/** Execution plan persisted on completed messages (historical messages only —
	 *  new streams persist the plan as plain text without subtasks). */
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

const MONO_STACK =
	"ui-monospace, 'SFMono-Regular', 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace";

/**
 * Header indicator — bare, no surrounding tag.
 *
 * Streaming: three vertical bars (`mf-bars`) reading as an audio-meter
 * for live activity. Completed: a small ink square anchoring the row.
 * On the stream→complete transition (justCompleted) the dot briefly
 * flashes activity color and emits a single sonar halo, then settles
 * to muted. The halo + flash are one-time — once the parent flips
 * justCompleted back to false they don't replay on re-renders.
 *
 * Both states are wrapped in a fixed 14×14 slot so the visible center
 * lands on x=10, matching the body rail's center and the connector.
 */
function HeaderIndicator({
	isStreaming,
	justCompleted,
}: {
	isStreaming: boolean;
	justCompleted: boolean;
}) {
	return (
		<span
			aria-hidden
			style={{
				position: "relative",
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				width: 14,
				height: 14,
				flexShrink: 0,
			}}
		>
			{isStreaming ? (
				<span
					style={{
						display: "inline-flex",
						alignItems: "flex-end",
						gap: 1.5,
						height: 10,
					}}
				>
					{[0, 1, 2].map((i) => (
						<span
							key={i}
							style={{
								width: 1.5,
								height: 10,
								background: "var(--chat-activity, var(--chat-primary))",
								transformOrigin: "bottom",
								animation: "mf-bars 0.95s cubic-bezier(.16,1,.3,1) infinite",
								animationDelay: `${i * 0.13}s`,
								display: "inline-block",
							}}
						/>
					))}
				</span>
			) : (
				<>
					<span
						style={{
							width: 5,
							height: 5,
							background: justCompleted
								? "var(--chat-activity, var(--chat-primary))"
								: "color-mix(in srgb, var(--chat-text) 42%, transparent)",
							boxShadow:
								"inset 0 0 0 0.5px color-mix(in srgb, var(--chat-text) 70%, transparent)",
							transform: justCompleted ? "scale(1.18)" : "scale(1)",
							transition:
								"background 820ms cubic-bezier(.16,1,.3,1), transform 540ms cubic-bezier(.16,1,.3,1)",
							display: "inline-block",
						}}
					/>
					{justCompleted && (
						<span
							style={{
								position: "absolute",
								left: "50%",
								top: "50%",
								width: 14,
								height: 14,
								marginLeft: -7,
								marginTop: -7,
								borderRadius: "50%",
								background:
									"radial-gradient(closest-side, color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 38%, transparent), transparent 70%)",
								animation: "mf-halo-once 720ms cubic-bezier(.16,1,.3,1) forwards",
								pointerEvents: "none",
							}}
						/>
					)}
				</>
			)}
		</span>
	);
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

	// One-shot completion delight. Fires only on the streaming→complete
	// transition; cold loads (existing messages) skip the animation
	// because prevStreaming was never `true` for this mount.
	const prevStreamingRef = useRef<boolean | null>(null);
	const [justCompleted, setJustCompleted] = useState(false);
	useEffect(() => {
		const justFinished = prevStreamingRef.current === true && isStreaming === false;
		prevStreamingRef.current = isStreaming;
		if (justFinished) {
			setJustCompleted(true);
			const t = setTimeout(() => setJustCompleted(false), 820);
			return () => clearTimeout(t);
		}
	}, [isStreaming]);

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

	// Aggregate a quiet summary preview for the collapsed completed-state
	// header. Counts user-visible tools only — subagent handles are omitted
	// since the list can grow long and crowd the row.
	const summaryPreview = useMemo(() => {
		if (isStreaming) return null;
		let toolCount = 0;

		const visit = (name?: string) => {
			if (!name) return;
			const lower = name.toLowerCase().trim();
			if (INTERNAL_TOOLS.has(lower)) return;
			toolCount += 1;
		};

		// Count from chunks when available — chunks is what the timeline
		// renders, and the message adapter populates it either from live
		// in-memory chunks or by reconstructing from executionTimeline. Falling
		// back to executionTimeline only when chunks is empty avoids the
		// double-counting that produced e.g. "6 tools" above 3 rendered rows.
		if (chunks.length > 0) {
			for (const c of chunks) {
				if (c.type === "tool") visit(c.toolName);
			}
		} else if (executionTimeline.length > 0) {
			for (const item of executionTimeline) {
				if (item.type === "tool") visit(item.tool as string | undefined);
			}
		}

		if (toolCount === 0) return null;
		return `${toolCount} ${toolCount === 1 ? "source" : "sources"}`;
	}, [isStreaming, chunks, executionTimeline]);

	// Don't render if no content
	if (!isStreaming) {
		const hasContent = plan || executionTimeline.length > 0 || chunks.length > 0;
		if (!hasContent) return null;
		if (hasContent && completedEvents.length === 0 && !plan && executionTimeline.length === 0) return null;
	}

	// Detect modes (used by getLabel; mode-specific iconography retired in
	// favor of a category-neutral wave indicator).
	const lastChunk = chunks.length > 0 ? chunks[chunks.length - 1] : null;
	const hasSubagent = hasSubagentChunks(chunks);

	// Live operation label — only shown while streaming. Prefers the
	// LLM-provided description; falls back to the raw tool name when
	// absent, mirroring the body-row fallback.
	const getLiveLabel = () => {
		// Sub-assistant mode — subagent type slugs are presentation-grade
		// handles (configured by the team), so they're safe to render.
		if (hasSubagent && lastChunk?.type === "subagent" && lastChunk?.subagentData)
			return lastChunk.subagentData.subagentType;

		const lastToolName = lastChunk?.toolName?.toLowerCase().trim();
		const lastIsInternal = !!lastToolName && INTERNAL_TOOLS.has(lastToolName);
		if (!lastIsInternal && lastChunk?.toolDescription) return lastChunk.toolDescription;
		if (!lastIsInternal && lastChunk?.toolName) return lastChunk.toolName;
		switch (lastChunk?.type) {
			case "planning":
				return "Planning…";
			case "thinking":
				return "Thinking…";
			case "tool":
				return "Thinking…";
			case "observation":
				return "Analyzing results…";
			case "progress":
				return "Working…";
			default:
				return "Thinking…";
		}
	};

	// Effective completed duration — favors the explicit prop, then the
	// computed total, then wall-clock fallback so the header always renders
	// some time figure when the panel has finished.
	const completedDuration =
		totalExecutionTime > 0 ? totalExecutionTime : wallClockSeconds > 0 ? wallClockSeconds : 0;

	const showPlanTimeline = plan?.subtasks && plan.subtasks.length >= 2;

	return (
		<div ref={containerRef} className={cn("max-w-full", className)}>
			{/* Clickable header: indicator + (live op | trace summary) + caret. */}
			<div
				onClick={() => setExpanded(!isExpanded)}
				style={{
					position: "relative",
					display: "inline-flex",
					alignItems: "center",
					gap: 8,
					padding: "3px 8px 3px 3px",
					borderRadius: 4,
					cursor: "pointer",
					transition: "background-color 220ms cubic-bezier(.16,1,.3,1)",
					background: isStreaming
						? "color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 6%, transparent)"
						: "transparent",
				}}>
				<HeaderIndicator isStreaming={isStreaming} justCompleted={justCompleted} />

				{/* Streaming: current operation in prose + tabular timer. */}
				{isStreaming && (
					<>
						<span
							style={{
								fontSize: 13.5,
								lineHeight: 1.35,
								fontWeight: 500,
								letterSpacing: "-0.005em",
								color: "color-mix(in srgb, var(--chat-text) 86%, transparent)",
								maxWidth: 520,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{getLiveLabel()}
						</span>
						{parseInt(liveElapsed) > 0 && (
							<span
								className="tabular-nums"
								style={{
									fontFamily: MONO_STACK,
									fontSize: 11,
									color:
										"color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 75%, var(--chat-text))",
									fontVariantNumeric: "tabular-nums",
									letterSpacing: "0.02em",
									fontWeight: 600,
								}}
							>
								{liveElapsed}s
							</span>
						)}
					</>
				)}

				{/* Completed: clean ops · duration in mono. */}
				{!isStreaming && (summaryPreview || completedDuration > 0) && (
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							fontFamily: MONO_STACK,
							fontSize: 11.5,
							fontWeight: 500,
							letterSpacing: "0.005em",
							color: "color-mix(in srgb, var(--chat-text) 55%, transparent)",
							fontVariantNumeric: "tabular-nums",
							fontVariantLigatures: "none",
						}}
					>
						{completedDuration > 0 && (
							<span>Thought for {formatDuration(completedDuration)}</span>
						)}
						{completedDuration > 0 && summaryPreview && (
							<span
								aria-hidden
								style={{
									width: 2,
									height: 2,
									borderRadius: "50%",
									background: "color-mix(in srgb, var(--chat-text) 28%, transparent)",
									display: "inline-block",
								}}
							/>
						)}
						{summaryPreview && <span>{summaryPreview}</span>}
					</span>
				)}

				{/* Sharp expand caret — silent affordance, rotates on toggle. */}
				<span
					aria-hidden
					style={{
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						width: 12,
						height: 12,
						marginLeft: 1,
						color: "color-mix(in srgb, var(--chat-text) 38%, transparent)",
						fontSize: 11,
						lineHeight: 1,
						transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
						transition: "transform 240ms cubic-bezier(.16,1,.3,1)",
					}}
				>
					›
				</span>

			</div>

			{isExpanded && (
				<div
					className="animate-fade-in"
					style={{ position: "relative", marginTop: 6 }}
				>
					{/* Continuous hairline connector: rail extends from the header
					    pill down to the first body row's badge center. left=9.5
					    puts the 1px line's center at x=10, matching both the
					    header dot center and the body rail center. */}
					<div
						aria-hidden
						style={{
							position: "absolute",
							left: 9.5,
							top: -6,
							width: 1,
							height: 10,
							background: "color-mix(in srgb, var(--chat-text) 10%, transparent)",
							pointerEvents: "none",
						}}
					/>
					{isStreaming ? (
						<EventTimeline events={streamingEvents} />
					) : // Completed mode
					plan ? (
						plan.subtasks?.length === 0 ? null : showPlanTimeline ? (
							<PlanTimeline plan={plan} streamingChunks={completedChunks} />
						) : (
							<EventTimeline events={completedEvents} />
						)
					) : (
						<EventTimeline events={completedEvents} />
					)}
				</div>
			)}
		</div>
	);
}
