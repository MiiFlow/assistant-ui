import { Wrench } from "lucide-react";
import { cn } from "../utils/cn";
import { MarkdownContent } from "./MarkdownContent";
import type { Event } from "../types";

interface EventContentProps {
  event: Event;
  className?: string;
  /** When true, shows animated gradient border effect */
  isRunning?: boolean;
}

/**
 * Renders content for different event types
 * - Thinking: Markdown content with subtle styling
 * - Planning: Markdown content with planning context
 * - Tool: Chip-style display with tool name (+ gradient border when running)
 * - Observation: Colored result panel
 */
export function EventContent({ event, className, isRunning }: EventContentProps) {
  if (event.type === "thinking") {
    return (
      <div
        className={cn(
          "p-1 rounded transition-colors",
          "bg-black/[0.01] hover:bg-black/[0.02]",
          className
        )}
      >
        <div className="text-[var(--chat-text-subtle)] text-[15px] leading-relaxed">
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
        <div className="text-[var(--chat-text-subtle)] text-[15px] leading-relaxed">
          <MarkdownContent>{event.content}</MarkdownContent>
        </div>
      </div>
    );
  }

  if (event.type === "tool") {
    return (
      <div className={cn("relative inline-flex", className)}>
        {/* Animated gradient border for running state */}
        {isRunning && (
          <div
            className="absolute -inset-[2px] rounded-md bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-gradient-shift opacity-70"
          />
        )}
        <div
          className={cn(
            "relative inline-flex items-center gap-1 px-2 py-0.5",
            "border border-[var(--chat-border)] rounded",
            "bg-white dark:bg-gray-900",
            isRunning && "border-transparent"
          )}
        >
          <Wrench size={14} className={cn(
            "text-[var(--chat-text-subtle)]",
            isRunning && "text-indigo-500"
          )} />
          <span className="text-[15px] text-[var(--chat-text)]">
            {event.toolDescription || event.toolName}
          </span>
        </div>
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
            "text-[15px]",
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
