import { ReactNode } from "react";
import { cn } from "../utils/cn";
import { StatusBadge } from "./StatusBadge";
import type { EventStatus } from "../types";

export interface TimelineItemData {
  id: string;
  status: EventStatus;
  content: ReactNode;
}

export interface TimelineProps {
  items: TimelineItemData[];
  badgeSize?: number;
  className?: string;
}

/**
 * Vertical timeline component
 * Displays items with status badges and connecting lines
 */
export function Timeline({ items, badgeSize = 20, className }: TimelineProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("max-w-full", className)}>
      <div className="flex flex-col">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const nextItem = !isLast ? items[index + 1] : null;
          const nextItemPending = nextItem?.status === "pending";
          // Show animated line when current item is running and connects to next
          const showAnimatedLine = item.status === "running" && !isLast;

          return (
            <div
              key={item.id}
              className="animate-fade-in"
              style={{
                display: "grid",
                gridTemplateColumns: `${badgeSize}px 1fr`,
                gap: "0.5rem",
                paddingBottom: isLast ? 0 : "0.5rem",
                position: "relative",
              }}
            >
              {/* Status Badge Column */}
              <div
                className="relative flex flex-col items-center flex-shrink-0"
                style={{ paddingTop: "4px" }}
              >
                <StatusBadge status={item.status} size={badgeSize} />

                {/* Vertical Connector Line */}
                {!isLast && (
                  showAnimatedLine ? (
                    // Animated energy flow line for running state
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-[2px] animate-flow-down"
                      style={{
                        top: badgeSize + 6,
                        height: `calc(100% - ${badgeSize}px + 4px)`,
                        background: `repeating-linear-gradient(
                          180deg,
                          rgb(99, 102, 241) 0px,
                          rgb(99, 102, 241) 4px,
                          transparent 4px,
                          transparent 8px
                        )`,
                        zIndex: 1,
                      }}
                    />
                  ) : (
                    // Static line for other states
                    <div
                      className="absolute left-1/2 -translate-x-1/2"
                      style={{
                        top: badgeSize + 6,
                        height: `calc(100% - ${badgeSize}px + 4px)`,
                        width: 0,
                        borderLeft: "2px",
                        borderStyle: nextItemPending ? "dashed" : "solid",
                        borderColor: "var(--chat-border)",
                        zIndex: 1,
                      }}
                    />
                  )
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 flex items-center">
                {item.content}
              </div>
            </div>
          );
        })}
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
 * Single timeline item (alternative API)
 */
export function TimelineItem({
  status,
  isLast = false,
  badgeSize = 16,
  children,
  className,
}: TimelineItemProps) {
  const showAnimatedLine = status === "running" && !isLast;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 animate-fade-in",
        !isLast && "pb-3",
        className
      )}
    >
      {/* Status Badge */}
      <div className="relative flex-shrink-0 pt-0.5">
        <StatusBadge status={status} size={badgeSize} />

        {/* Vertical Connector Line */}
        {!isLast && (
          showAnimatedLine ? (
            // Animated energy flow line for running state
            <div
              className="absolute w-[2px] animate-flow-down"
              style={{
                left: badgeSize / 2 - 1,
                top: badgeSize + 4,
                height: "calc(100% + 12px)",
                background: `repeating-linear-gradient(
                  180deg,
                  rgb(99, 102, 241) 0px,
                  rgb(99, 102, 241) 4px,
                  transparent 4px,
                  transparent 8px
                )`,
                zIndex: 1,
              }}
            />
          ) : (
            // Static line for other states
            <div
              className="absolute bg-[var(--chat-border)] opacity-30"
              style={{
                left: badgeSize / 2 - 0.5,
                top: badgeSize + 4,
                height: "calc(100% + 12px)",
                width: 1,
                zIndex: 1,
              }}
            />
          )
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
