import { Wrench } from "lucide-react";
import { cn } from "../utils/cn";
import { MarkdownContent } from "./MarkdownContent";
import type { Event } from "../types";

interface EventContentProps {
  event: Event;
  className?: string;
}

/**
 * Renders content for different event types
 * - Thinking: Markdown content with subtle styling
 * - Planning: Markdown content with planning context
 * - Tool: Chip-style display with tool name
 * - Observation: Colored result panel
 */
export function EventContent({ event, className }: EventContentProps) {
  if (event.type === "thinking") {
    return (
      <div
        className={cn(
          "p-1 rounded transition-colors",
          "bg-black/[0.01] hover:bg-black/[0.02]",
          className
        )}
      >
        <div className="text-[var(--chat-text-subtle)] text-sm leading-relaxed">
          <MarkdownContent>{event.content}</MarkdownContent>
        </div>
      </div>
    );
  }

  if (event.type === "planning") {
    return (
      <div
        className={cn(
          "p-1 rounded transition-colors",
          "bg-black/[0.01] hover:bg-black/[0.02]",
          className
        )}
      >
        <div className="text-[var(--chat-text-subtle)] text-sm leading-relaxed">
          <MarkdownContent>{event.content}</MarkdownContent>
        </div>
      </div>
    );
  }

  if (event.type === "tool") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5",
          "border border-[var(--chat-border)] rounded",
          "bg-white",
          className
        )}
      >
        <Wrench size={14} className="text-[var(--chat-text-subtle)]" />
        <span className="text-sm text-[var(--chat-text)]">
          {event.toolDescription || event.toolName}
        </span>
      </div>
    );
  }

  if (event.type === "observation") {
    const success = event.success !== false;

    return (
      <div
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
            "text-sm",
            success ? "text-green-900" : "text-yellow-900"
          )}
        >
          <MarkdownContent>{event.content}</MarkdownContent>
        </div>
      </div>
    );
  }

  return null;
}
