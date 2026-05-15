import { useEffect, useRef } from "react";
import { Wrench } from "lucide-react";
import { cn } from "../utils/cn";
import { injectBeamerKeyframes, beamerBarStyle } from "../utils/beamer";
import { convertChunkToEvent } from "./EventTimeline";
import { MarkdownContent } from "./MarkdownContent";
import { TimelineRow } from "./TimelineRow";
import type { Event } from "../types";

interface EventContentProps {
  event: Event;
  className?: string;
  /** When true, shows beamer scanning effect on tool items */
  isRunning?: boolean;
}

/**
 * Renders content for different event types
 * - Thinking: Markdown content with subtle styling
 * - Planning: Markdown content with planning context
 * - Tool: Inline icon + text display with beamer effect when running
 * - Observation: Colored result panel
 */
export function EventContent({ event, className, isRunning }: EventContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { injectBeamerKeyframes(containerRef.current); }, []);
  if (event.type === "thinking") {
    return (
      <div
        ref={containerRef}
        className={cn(
          "p-1 rounded transition-colors min-w-0 max-w-full",
          "bg-black/[0.01] hover:bg-black/[0.02]",
          className
        )}
      >
        <div className="text-[var(--chat-text-subtle)] leading-relaxed min-w-0 max-w-full">
          <MarkdownContent className="text-[14px]">{event.content}</MarkdownContent>
        </div>
      </div>
    );
  }

  if (event.type === "planning") {
    return (
      <div
        ref={containerRef}
        className={cn(
          "p-1 rounded transition-colors min-w-0 max-w-full",
          "bg-black/[0.01] hover:bg-black/[0.02]",
          className
        )}
      >
        <div className="text-[var(--chat-text-subtle)] leading-relaxed min-w-0 max-w-full">
          <MarkdownContent className="text-[14px]">{event.content}</MarkdownContent>
        </div>
      </div>
    );
  }

  if (event.type === "tool") {
    return (
      <div
        ref={containerRef}
        className={cn("inline-flex items-center gap-1.5", className)}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 4,
          ...(isRunning && {
            backgroundColor: "var(--chat-message-bg)",
            padding: "2px 4px",
          }),
        }}
      >
        {isRunning && <div style={beamerBarStyle} />}
        <Wrench
          size={14}
          className="text-[var(--chat-text-subtle)] relative z-10 shrink-0"
        />
        <span className="text-[14px] text-[var(--chat-text)] relative z-10">
          {event.toolDescription || event.toolName}
        </span>
      </div>
    );
  }

  if (event.type === "observation") {
    const success = event.success !== false;
    const accentVar = success ? "--chat-secondary" : "--chat-warning";

    return (
      <div
        ref={containerRef}
        className={cn(
          "px-3 py-1.5 rounded max-w-full overflow-auto",
          className
        )}
        style={{
          borderLeft: `3px solid var(${accentVar})`,
          backgroundColor: `color-mix(in srgb, var(${accentVar}) 6%, transparent)`,
        }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wide block mb-1"
          style={{ color: `var(${accentVar})` }}
        >
          {event.toolName} Result
        </span>
        <div className="text-[var(--chat-text)]">
          <MarkdownContent className="text-[14px]">{event.content}</MarkdownContent>
        </div>
      </div>
    );
  }

  if (event.type === "subagent") {
    const data = event.subagentData;
    const nestedEvents: Event[] = (data.nestedChunks ?? [])
      .map((c, i) => convertChunkToEvent(c, i))
      .filter((e): e is Event => e !== null);
    if (data.result && data.result.trim().length > 0) {
      nestedEvents.push({
        id: `result-${data.subagentId}`,
        type: "thinking",
        status: data.status === "failed" ? "failed" : "completed",
        content: data.result,
      });
    }
    const humanLabel = data.subagentType
      .split(/[_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return (
      <TimelineRow
        label={humanLabel || "Sub-assistant"}
        durationSeconds={data.durationMs != null ? data.durationMs / 1000 : undefined}
        isFailed={data.status === "failed"}
        defaultExpanded={data.status === "running"}
        nestedEvents={nestedEvents}
      />
    );
  }

  return null;
}
