import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Event } from "../types";
import { cn } from "../utils/cn";
import { EventTimeline } from "./EventTimeline";

export interface TimelineRowProps {
	/** Primary label — subtask description, agent name, or humanized handle. */
	label: string;
	/** Secondary text — task summary, self-description, or error message. */
	description?: string;
	/** Duration in seconds. Rendered right-aligned with tabular numerals. */
	durationSeconds?: number;
	/** Apply failed-state coloring to label/description. */
	isFailed?: boolean;
	/** Auto-expand the row when first rendered (e.g. when running). */
	defaultExpanded?: boolean;
	/** Nested events rendered in an indented body when expanded. */
	nestedEvents?: Event[];
	/** When true, the chevron is suppressed (used for non-expandable rows). */
	hideChevron?: boolean;
}

/**
 * Shared row content used by every reasoning-panel timeline:
 * plan subtasks, multi-agent subagents, and sub-assistant dispatches.
 *
 * The leading status badge and connector are provided by the parent
 * `Timeline`; this component only owns the label/description/duration row
 * and the nested timeline that expands beneath it.
 */
export function TimelineRow({
	label,
	description,
	durationSeconds,
	isFailed = false,
	defaultExpanded = false,
	nestedEvents,
	hideChevron = false,
}: TimelineRowProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);
	const hasNested = !!(nestedEvents && nestedEvents.length > 0);
	const showChevron = hasNested && !hideChevron;

	return (
		<div className="flex-1 min-w-0">
			<div
				onClick={showChevron ? () => setIsExpanded(!isExpanded) : undefined}
				className={cn(
					"flex items-center gap-2 min-w-0",
					showChevron && "cursor-pointer",
				)}
			>
				<span
					className={cn(
						"text-sm font-medium truncate",
						isFailed ? "text-[var(--chat-error)]" : "text-[var(--chat-text)]",
					)}
				>
					{label}
				</span>

				{description && (
					<span
						className={cn(
							"text-sm truncate flex-1",
							isFailed
								? "text-[var(--chat-error)]"
								: "text-[var(--chat-text-subtle)]",
						)}
					>
						{description}
					</span>
				)}

				{durationSeconds != null && durationSeconds > 0 && (
					<span className="text-xs text-[var(--chat-placeholder)] shrink-0 tabular-nums">
						{durationSeconds.toFixed(1)}s
					</span>
				)}

				{showChevron && (
					<span className="text-[var(--chat-placeholder)] shrink-0 flex items-center">
						{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
					</span>
				)}
			</div>

			{hasNested && isExpanded && (
				<div className="mt-2 pl-2">
					<EventTimeline events={nestedEvents!} />
				</div>
			)}
		</div>
	);
}
