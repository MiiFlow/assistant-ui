import { ReactNode, useEffect, useRef } from "react";
import { cn } from "../utils/cn";
import { StatusBadge } from "./StatusBadge";
import type { EventStatus } from "../types";
import { injectBeamerKeyframes } from "../utils/beamer";

export type TimelineItemKind =
  | "thinking"
  | "planning"
  | "tool"
  | "observation"
  | "subagent";

export interface TimelineItemData {
  id: string;
  status: EventStatus;
  content: ReactNode;
  /**
   * When true, the parent Timeline does not apply the running-state
   * gradient wash to this row's content cell. Use for rows that own a
   * nested timeline (e.g. subagents) — the wash bleeds behind the entire
   * expanded body and reads as a card around the group.
   */
  bare?: boolean;
  /**
   * Semantic kind of this row. Drives adjacency-aware vertical spacing
   * (consecutive thoughts pack tighter; tool/subagent boundaries breathe
   * wider) and the StatusBadge marker variant (subagent gets a ring).
   */
  kind?: TimelineItemKind;
}

export interface TimelineProps {
  items: TimelineItemData[];
  badgeSize?: number;
  className?: string;
}

/**
 * Adjacency-aware bottom padding between rows. Mirrors the rhythm of a
 * research notebook: same-kind consecutive rows pack as a tight cluster
 * (a paragraph of thought, a burst of tool calls); mode transitions get
 * breathing room; dispatched threads and result panels stand on their own
 * with a strong section break.
 */
function spacingFor(current?: TimelineItemKind, next?: TimelineItemKind): number {
  if (!next) return 0;
  // Subagent rows used to claim 14px of air on each side so their (then-
  // always-expanded) nested body felt like its own section. With the
  // refreshed chip-style header that's usually collapsed, that gap reads
  // as inconsistent vertical rhythm against the tight tool cluster
  // around it. Match the cross-kind transition baseline instead — the
  // subagent's own expanded body provides separation when needed.
  if (current === "subagent" || next === "subagent") return 6;
  if (current === "observation" || next === "observation") return 12;
  // Same kind in a row: hug close so the cluster reads as one unit.
  if (current === next) return 4;
  // Mode transition (e.g. thinking → tool, tool → thinking): give air.
  return 9;
}

/**
 * Vertical timeline — refreshed look.
 *
 * One unbroken hairline rail down the badge column with rail-anchored ink
 * markers. The active segment carries a soft downward-flowing gradient
 * slice; running rows get a left-anchored gradient wash on the content
 * side. Spacing varies by adjacency so the panel reads like prose, not a
 * uniform list.
 */
export function Timeline({ items, badgeSize = 20, className }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    injectBeamerKeyframes(containerRef.current);
  }, []);

  if (items.length === 0) {
    return null;
  }

  const railCenter = badgeSize / 2;

  return (
    <div ref={containerRef} className={cn("max-w-full", className)}>
      <div style={{ position: "relative" }}>
        {/* Continuous hairline rail running the full height of the timeline. */}
        {items.length > 1 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: railCenter - 0.5,
              top: 6,
              bottom: 6,
              width: 1,
              background: "color-mix(in srgb, var(--chat-text) 10%, transparent)",
              pointerEvents: "none",
            }}
          />
        )}

        <div className="flex flex-col">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isRunning = item.status === "running";
            const showFlow = isRunning && !isLast;
            const bottomPad = isLast
              ? 0
              : spacingFor(item.kind, items[index + 1]?.kind);

            return (
              <div
                key={item.id}
                className="mf-row-enter"
                style={{
                  display: "grid",
                  gridTemplateColumns: `${badgeSize}px 1fr`,
                  columnGap: "0.625rem",
                  paddingBottom: bottomPad,
                  position: "relative",
                }}
              >
                {/* Status marker column */}
                <div
                  className="relative flex flex-col items-center flex-shrink-0"
                  style={{ paddingTop: 4 }}
                >
                  <StatusBadge status={item.status} size={badgeSize} kind={item.kind} />

                  {/* Flowing gradient slice on the active rail segment. */}
                  {showFlow && (
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        top: badgeSize + 4,
                        width: 1,
                        height: `calc(100% - ${badgeSize}px + 4px)`,
                        overflow: "hidden",
                        pointerEvents: "none",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: "100%",
                          height: "55%",
                          background:
                            "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 70%, transparent) 50%, transparent 100%)",
                          animation: "mf-rail-flow 1.6s cubic-bezier(.16,1,.3,1) infinite",
                          willChange: "transform",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Content column — shimmer now lives on the text itself
                    (see EventContent's running-state styles), not on the
                    row, so we no longer need a positioned overlay here. */}
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    position: "relative",
                    overflow: "hidden",
                    paddingTop: 2,
                    paddingBottom: 2,
                  }}
                >
                  {item.content}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface TimelineItemProps {
  status: EventStatus;
  isLast?: boolean;
  badgeSize?: number;
  children: ReactNode;
  className?: string;
}

/**
 * Single timeline item (alternative API). Matches the refreshed look of
 * the parent `Timeline`: hairline rail, ink-dot markers, no card chrome.
 */
export function TimelineItem({
  status,
  isLast = false,
  badgeSize = 20,
  children,
  className,
}: TimelineItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    injectBeamerKeyframes(itemRef.current);
  }, []);
  const isRunning = status === "running";
  const showFlow = isRunning && !isLast;

  return (
    <div
      ref={itemRef}
      className={cn("relative flex items-start gap-2.5 animate-fade-in", !isLast && "pb-3", className)}
    >
      <div className="relative flex-shrink-0" style={{ paddingTop: 4 }}>
        {!isLast && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: badgeSize / 2 - 0.5,
              top: badgeSize + 4,
              width: 1,
              height: "calc(100% + 8px)",
              background: "color-mix(in srgb, var(--chat-text) 10%, transparent)",
              pointerEvents: "none",
            }}
          />
        )}

        <StatusBadge status={status} size={badgeSize} />

        {showFlow && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: badgeSize / 2 - 0.5,
              top: badgeSize + 4,
              width: 1,
              height: "calc(100% + 8px)",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "55%",
                background:
                  "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--chat-activity, var(--chat-primary)) 70%, transparent) 50%, transparent 100%)",
                animation: "mf-rail-flow 1.6s cubic-bezier(.16,1,.3,1) infinite",
                willChange: "transform",
              }}
            />
          </div>
        )}
      </div>

      <div
        style={{
          minWidth: 0,
          flex: 1,
          position: "relative",
          overflow: "hidden",
          borderRadius: 4,
        }}
      >
        {children}
      </div>
    </div>
  );
}
