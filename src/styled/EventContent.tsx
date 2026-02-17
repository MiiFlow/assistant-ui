import { useEffect, useRef } from "react";
import { Wrench } from "lucide-react";
import { cn } from "../utils/cn";
import { injectBeamerKeyframes, beamerBarStyle } from "../utils/beamer";
import { MarkdownContent } from "./MarkdownContent";
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
          "p-1 rounded transition-colors",
          "bg-black/[0.01] hover:bg-black/[0.02]",
          className
        )}
      >
        <div className="text-[var(--chat-text-subtle)] leading-relaxed">
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
          "p-1 rounded transition-colors",
          "bg-black/[0.01] hover:bg-black/[0.02]",
          className
        )}
      >
        <div className="text-[var(--chat-text-subtle)] leading-relaxed">
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
            backgroundColor: "rgba(0, 0, 0, 0.02)",
            padding: "2px 4px",
          }),
        }}
      >
        {isRunning && <div style={beamerBarStyle} />}
        <Wrench size={14} className="text-black/50 relative z-10 shrink-0" />
        <span className="text-[14px] text-black/65 relative z-10">
          {event.toolDescription || event.toolName}
        </span>
      </div>
    );
  }

  if (event.type === "observation") {
    const success = event.success !== false;

    return (
      <div
        ref={containerRef}
        className={cn(
          "px-3 py-1.5 rounded max-w-full overflow-auto",
          success
            ? "bg-green-50 border-l-[3px] border-green-400"
            : "bg-yellow-50 border-l-[3px] border-yellow-400",
          className
        )}
      >
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide block mb-1",
            success ? "text-green-700" : "text-yellow-700"
          )}
        >
          {event.toolName} Result
        </span>
        <div
          className={cn(
            success ? "text-green-900" : "text-yellow-900"
          )}
        >
          <MarkdownContent className="text-[14px]">{event.content}</MarkdownContent>
        </div>
      </div>
    );
  }

  return null;
}
