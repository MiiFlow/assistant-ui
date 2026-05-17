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
 * The leading status marker and rail are provided by the parent
 * `Timeline`; this component only owns the label/description/duration row
 * and the nested timeline that expands beneath it.
 *
 * Refreshed look: the lucide chevron is replaced by a typographic caret
 * that rotates on expand; the duration is rendered as a tabular-num pill
 * with quiet weight so it reads as data, not chrome.
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
						"text-sm truncate",
						isFailed ? "text-[var(--chat-error)]" : "text-[var(--chat-text)]",
					)}
					style={{ fontWeight: 500, letterSpacing: "-0.005em" }}
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
					<span
						className="shrink-0 tabular-nums"
						style={{
							fontSize: 11,
							color: "color-mix(in srgb, var(--chat-text) 50%, transparent)",
							fontVariantNumeric: "tabular-nums",
							letterSpacing: "0.01em",
						}}
					>
						{durationSeconds.toFixed(1)}s
					</span>
				)}

				{showChevron && (
					<span
						aria-hidden
						className="shrink-0 inline-flex items-center justify-center"
						style={{
							width: 14,
							height: 14,
							color: "color-mix(in srgb, var(--chat-text) 40%, transparent)",
							fontSize: 11,
							lineHeight: 1,
							transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
							transition: "transform 220ms cubic-bezier(.16,1,.3,1)",
						}}
					>
						›
					</span>
				)}
			</div>

			{hasNested && isExpanded && (
				<div className="mt-2 pl-2 animate-fade-in">
					<EventTimeline events={nestedEvents!} />
				</div>
			)}
		</div>
	);
}
