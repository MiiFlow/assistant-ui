import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { injectBeamerKeyframes } from "../utils/beamer";
import { convertChunkToEvent, EventTimeline } from "./EventTimeline";
import { MarkdownContent } from "./MarkdownContent";
import type { Event } from "../types";

interface EventContentProps {
  event: Event;
  className?: string;
  /** Active state — drives the trailing caret on tool calls. */
  isRunning?: boolean;
  /**
   * Slowest duration in the surrounding timeline. Used to scale this row's
   * trailing micro-bar so the panel reads as a proportional trace.
   */
  maxDurationSeconds?: number;
}

/**
 * Compact "tool call" mark — Lucide-style 3/4-view open-end wrench.
 *
 * Universal symbol for "tool / fix / configure" so it reads instantly
 * as a tool call. Stamps every tool row so the eye groups them as a
 * distinct event class, separate from prose thoughts (no mark) and
 * subagent dispatches (`@handle`).
 *
 * Color inherits from the surrounding span via `currentColor`, allowing
 * theme-aware tinting at the call site.
 */
function ToolCallMark() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0, display: "block" }}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

const MONO_STACK =
  "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace";

/**
 * Theme-adaptive text-shimmer styles applied to the live, in-progress
 * row. A gradient masked by the text shape sweeps across the characters
 * so the *text itself* shimmers, not the background.
 *
 * The gradient is symmetrical with dim 25% shoulders and a full-strength
 * peak; with `background-size: 200% 100%` and the `mf-text-shimmer`
 * keyframe moving `background-position` from 100% to -100%, the bright
 * peak traverses the visible area exactly once per cycle. Basis color is
 * `--chat-text`, so the effect adapts to light and dark themes.
 */
const TEXT_SHIMMER_STYLE: React.CSSProperties = {
  // Dark base text with a lighter "highlight" peak that travels through
  // the characters. Shoulders sit at full `--chat-text`; the peak fades
  // to ~35% so each character momentarily reads as a highlight wash as
  // the beam passes. Inverts the more common "shimmer-draws-the-text"
  // pattern in favor of a "scan-lightens-the-text" feel.
  backgroundImage:
    "linear-gradient(90deg, var(--chat-text) 0%, var(--chat-text) 40%, color-mix(in srgb, var(--chat-text) 35%, transparent) 50%, var(--chat-text) 60%, var(--chat-text) 100%)",
  backgroundSize: "200% 100%",
  // Tile horizontally so the next peak enters from the left as the
  // previous one exits right; gradient endpoints both match the base
  // ink, so the tile seam is invisible.
  backgroundRepeat: "repeat-x",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
  animation: "mf-text-shimmer 2.4s linear infinite",
};

/**
 * Inline duration affordance. Renders a tabular-num seconds figure with a
 * proportional 24px micro-bar underneath — sized relative to the slowest
 * event in the timeline. Turns the reasoning panel into a tiny APM trace
 * where the bottleneck step is instantly scannable.
 */
function DurationTrail({
  seconds,
  maxSeconds,
}: {
  seconds: number;
  maxSeconds: number;
}) {
  const fraction = maxSeconds > 0 ? Math.min(1, Math.max(0.08, seconds / maxSeconds)) : 0.2;
  return (
    <span
      aria-label={`${seconds.toFixed(1)} seconds`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
        marginLeft: 8,
        flexShrink: 0,
        paddingTop: 2,
      }}
    >
      <span
        className="tabular-nums"
        style={{
          fontSize: 11,
          color: "color-mix(in srgb, var(--chat-text) 45%, transparent)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.01em",
          lineHeight: 1,
        }}
      >
        {seconds.toFixed(1)}s
      </span>
      <span
        aria-hidden
        style={{
          width: 24,
          height: 1.5,
          background: "color-mix(in srgb, var(--chat-text) 8%, transparent)",
          borderRadius: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${fraction * 100}%`,
            background: "color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 60%, transparent)",
            borderRadius: 1,
          }}
        />
      </span>
    </span>
  );
}

/**
 * Refreshed event content.
 *
 * - Thinking / planning render as prose at 78% ink with relaxed leading;
 *   active rows bump to weight 500 so the eye lands on live content.
 * - Tool calls render as an inline monospace tag. The redundant inner dot
 *   is gone (the rail badge already conveys state at the same y); a soft
 *   caret blinks at the trailing edge while running.
 * - Completed rows get a right-aligned duration with a proportional micro-
 *   bar — the panel reads as a tiny trace.
 * - Observations use a quiet tinted background, no side-stripe.
 */
export function EventContent({
  event,
  className,
  isRunning,
  maxDurationSeconds,
}: EventContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    injectBeamerKeyframes(containerRef.current);
  }, []);

  const hasDuration =
    event.durationSeconds != null && event.durationSeconds > 0.05;

  if (event.type === "thinking" || event.type === "planning") {
    return (
      <div
        ref={containerRef}
        className={cn("min-w-0 max-w-full", className)}
        style={{
          // No horizontal padding so the text starts at the same x as the
          // tool-row's mono text (which is inline-flex with no padding).
          // Otherwise sans-thinking sits 2px right of mono-tool and the
          // labels read as misaligned down the rail.
          paddingTop: 1,
          paddingBottom: 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div
          style={{
            lineHeight: 1.6,
            letterSpacing: "-0.005em",
            fontWeight: isRunning ? 480 : 400,
            flex: 1,
            minWidth: 0,
            ...(isRunning
              ? TEXT_SHIMMER_STYLE
              : {
                  color: "color-mix(in srgb, var(--chat-text) 78%, transparent)",
                }),
          }}
        >
          <MarkdownContent className="text-[14px]">{event.content}</MarkdownContent>
        </div>
        {hasDuration && (
          <DurationTrail
            seconds={event.durationSeconds!}
            maxSeconds={maxDurationSeconds ?? event.durationSeconds!}
          />
        )}
      </div>
    );
  }

  if (event.type === "tool") {
    // Prefer the LLM-provided description (user-facing prose); when
    // absent, fall back to the raw tool name. The previous "Working…"
    // placeholder looked weird in completed states — a slug, even if
    // implementation-y, reads as a real event. The chip-style display
    // that exposed the slug ALONGSIDE the description is what got
    // dropped; this single-label fallback is fine.
    const description = event.toolDescription?.trim();
    const hasDescription = !!description && description.length > 0;
    const label = hasDescription ? description! : event.toolName || "Tool call";

    return (
      <div
        ref={containerRef}
        className={cn("mf-tool-row inline-flex items-center gap-2.5 min-w-0 max-w-full", className)}
        style={{ position: "relative" }}
        title={event.toolName}
      >
        <span
          aria-hidden
          className="mf-tool-mark"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 14,
            height: 14,
            color:
              "color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 70%, var(--chat-text))",
            opacity: 0.82,
          }}
        >
          <ToolCallMark />
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            // Slug fallbacks render in mono so a raw `render_table` reads
            // as a code identifier rather than malformed prose. Real
            // descriptions stay in sans body text.
            fontFamily: hasDescription ? undefined : MONO_STACK,
            fontVariantLigatures: hasDescription ? undefined : "none",
            fontSize: hasDescription ? 14 : 12.5,
            lineHeight: 1.5,
            letterSpacing: "-0.005em",
            fontWeight: hasDescription ? 450 : 500,
            fontVariantNumeric: "tabular-nums",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            ...(isRunning
              ? TEXT_SHIMMER_STYLE
              : {
                  color: "color-mix(in srgb, var(--chat-text) 86%, transparent)",
                }),
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {label}
          </span>
          {isRunning && (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 2,
                height: "0.95em",
                background: "var(--chat-activity, var(--chat-primary))",
                marginLeft: 4,
                animation: "mf-caret 1.05s cubic-bezier(.4,0,.6,1) infinite",
                borderRadius: 1,
                flexShrink: 0,
                // Caret must stay solid; the shimmer-styled parent uses
                // background-clip:text and would otherwise erase it.
                WebkitTextFillColor: "currentColor",
                color: "var(--chat-activity, var(--chat-primary))",
                backgroundImage: "none",
                backgroundClip: "border-box",
                WebkitBackgroundClip: "border-box",
              }}
            />
          )}
        </span>

        {hasDuration && (
          <DurationTrail
            seconds={event.durationSeconds!}
            maxSeconds={maxDurationSeconds ?? event.durationSeconds!}
          />
        )}
      </div>
    );
  }

  if (event.type === "observation") {
    const success = event.success !== false;
    const accentVar = success ? "--chat-secondary" : "--chat-warning";

    return (
      <div
        ref={containerRef}
        className={cn("max-w-full overflow-auto", className)}
        style={{
          padding: "8px 12px",
          borderRadius: 3,
          background: `color-mix(in srgb, var(${accentVar}) 4%, transparent)`,
          boxShadow: `inset 0 0 0 0.5px color-mix(in srgb, var(${accentVar}) 22%, transparent)`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 3,
              height: 3,
              background: `var(${accentVar})`,
            }}
          />
          <span
            style={{
              fontFamily: MONO_STACK,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: `var(${accentVar})`,
              fontVariantLigatures: "none",
            }}
          >
            response
          </span>
        </div>
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
    return (
      <SubagentChip
        slug={data.subagentType || "sub-assistant"}
        durationSeconds={data.durationMs != null ? data.durationMs / 1000 : undefined}
        isRunning={data.status === "running"}
        isFailed={data.status === "failed"}
        defaultExpanded={data.status === "running"}
        nestedEvents={nestedEvents}
      />
    );
  }

  return null;
}

interface SubagentChipProps {
  slug: string;
  durationSeconds?: number;
  isRunning: boolean;
  isFailed: boolean;
  defaultExpanded: boolean;
  nestedEvents: Event[];
}

/**
 * Identity-chip rendering for dispatched subagents.
 *
 * Reads as a Slack/GitHub @mention — a monospace handle, quiet tabular
 * duration, and a soft rotating caret. The status badge in the parent
 * timeline rail conveys activity; this row stays chrome-free so the
 * expanded body of nested events doesn't read as a card.
 */
function SubagentChip({
  slug,
  durationSeconds,
  isRunning,
  isFailed,
  defaultExpanded,
  nestedEvents,
}: SubagentChipProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasNested = nestedEvents.length > 0;
  const showCaret = hasNested;

  const handleColor = isFailed
    ? "var(--chat-error)"
    : isRunning
      ? "color-mix(in srgb, var(--chat-text) 92%, transparent)"
      : "color-mix(in srgb, var(--chat-text) 78%, transparent)";

  return (
    <div className="flex-1 min-w-0">
      <div
        onClick={hasNested ? () => setIsExpanded((v) => !v) : undefined}
        className={cn(
          "inline-flex items-center gap-2 min-w-0 max-w-full",
          hasNested && "cursor-pointer",
        )}
        style={{ paddingTop: 1, paddingBottom: 1 }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            fontFamily: MONO_STACK,
            fontSize: 13,
            lineHeight: 1.35,
            fontWeight: 500,
            letterSpacing: 0,
            color: handleColor,
            fontVariantLigatures: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              opacity: 0.55,
              marginRight: 1,
              fontWeight: 400,
            }}
          >
            @
          </span>
          {slug}
        </span>

        {durationSeconds != null && durationSeconds > 0 ? (
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
        ) : isRunning ? (
          <span
            className="shrink-0"
            style={{
              fontSize: 11,
              color: "color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 85%, transparent)",
              fontStyle: "italic",
              letterSpacing: "0.01em",
            }}
          >
            running…
          </span>
        ) : null}

        {showCaret && (
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
        <div
          className="animate-fade-in"
          style={{ marginTop: 6, paddingLeft: 14 }}
        >
          <EventTimeline events={nestedEvents} />
        </div>
      )}
    </div>
  );
}
