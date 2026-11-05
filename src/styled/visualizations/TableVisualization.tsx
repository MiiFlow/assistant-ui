import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Copy as CopyIcon,
} from "lucide-react";
import { compareTableValues } from "../../utils/table-ordering";
import { tableBadgeTone, type TableBadgeTone } from "../../utils/table-badge-tone";
import { cn } from "../../utils/cn";
import { TableCellText } from "./TableCellText";
import type {
  MediaChunkData,
  TableVisualizationData,
  TableColumn,
  TableColumnType,
  VisualizationConfig,
} from "../../types";
import {
  MediaLightbox,
  PlayOverlay,
  YOUTUBE_ID_RE,
  parseMediaValue,
  useMediaLightbox,
  type MediaItem,
} from "../MediaLightbox";

export interface TableVisualizationProps {
  data: TableVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
  /** Message-level media bag used to resolve `media_ref:<id>` cell values. */
  medias?: MediaChunkData[];
}

type Order = "asc" | "desc";

// Column types that render as short, fixed-width atoms — keep nowrap so the
// column width stays visually tight. Everything else wraps by default so
// long strings are readable without truncation.
const _NOWRAP_TYPES = new Set<TableColumnType>([
  "number",
  "currency",
  "date",
  "badge",
  "boolean",
  "progress",
]);

/** Stringify any value for title attributes + hover card. */
function _cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Per-cell hover popover: selectable, copyable, portal-rendered.
 *
 * Two UX requirements drive the implementation:
 *   - text must be selectable so users can copy it → pointer-events: auto
 *   - cursor must be able to travel from cell → popover without the popover
 *     closing (otherwise users can never reach the content). onEnter/onLeave
 *     callbacks hand off hover tracking to the parent, which debounces the
 *     close so crossing the gap doesn't dismiss.
 *
 * Visual: no header — just the content and a small copy icon pinned to
 * the bottom-right corner. Keeps focus on the data.
 */
function CellHoverPopover({
  text,
  anchorRect,
  onEnter,
  onLeave,
}: {
  text: string;
  anchorRect: DOMRect;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (typeof document === "undefined") return null;

  // Position below the cell by default; flip above if we'd clip the viewport.
  // Width is max-content so short values produce compact cards (hover-card
  // feel) — long values grow up to POPOVER_MAX_WIDTH before wrapping.
  const VIEWPORT_MARGIN = 16;
  const POPOVER_MAX_WIDTH = Math.min(
    360,
    window.innerWidth - 2 * VIEWPORT_MARGIN,
  );
  const spaceBelow = window.innerHeight - anchorRect.bottom - VIEWPORT_MARGIN;
  const placeBelow = spaceBelow >= 120 || spaceBelow >= anchorRect.top;

  // Clamp `left` using the max width as a pessimistic estimate. When the
  // actual card is narrower this just leaves more room on the right —
  // visually fine, and avoids a second measure/layout pass.
  let left = anchorRect.left;
  if (left + POPOVER_MAX_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
    left = Math.max(
      VIEWPORT_MARGIN,
      window.innerWidth - POPOVER_MAX_WIDTH - VIEWPORT_MARGIN,
    );
  }

  const style: React.CSSProperties = {
    position: "fixed",
    left,
    width: "max-content",
    maxWidth: POPOVER_MAX_WIDTH,
    maxHeight: "50vh",
    zIndex: 9998,
    ...(placeBelow
      ? { top: anchorRect.bottom + 4 }
      : { bottom: window.innerHeight - anchorRect.top + 4 }),
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked (insecure context, permission denied). Users can
      // still select the text manually.
    }
  };

  return createPortal(
    <div
      style={style}
      className={cn(
        "relative overflow-hidden rounded-md border border-[var(--chat-border)] bg-[var(--chat-surface-raised)] shadow-lg",
      )}
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        className={cn(
          "select-text overflow-auto px-2.5 py-1.5 pr-8 text-sm text-[var(--chat-text)]",
          "whitespace-pre-wrap break-words",
        )}
        style={{ maxHeight: "50vh" }}
      >
        {text || <span className="text-[var(--chat-text-subtle)]">—</span>}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy"}
        title={copied ? "Copied" : "Copy"}
        className={cn(
          "absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center",
          "rounded text-[var(--chat-text-subtle)] transition-colors",
          "hover:bg-[color-mix(in_srgb,var(--chat-text)_6%,transparent)] hover:text-[var(--chat-text)]",
        )}
      >
        {copied ? <Check size={12} /> : <CopyIcon size={12} />}
      </button>
    </div>,
    document.body,
  );
}

/** Inline media cell: clickable thumbnail that opens the table-wide lightbox. */
function MediaCell({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  if (item.mediaType === "video") {
    const ytMatch = item.url.match(YOUTUBE_ID_RE);
    const ytId = ytMatch ? ytMatch[1] : null;
    const posterSrc =
      item.posterUrl ||
      (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : undefined);
    return (
      <button
        type="button"
        onClick={onOpen}
        className="relative block overflow-hidden rounded-md border-0 bg-black/5 p-0"
        style={{ width: 72, height: 72 }}
        aria-label={item.altText || "Open video"}
      >
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={item.altText || "Video preview"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          // No text: a 72px tile has no room beside the 56px play circle,
          // which would cover it. The circle and the button's name say "video".
          <div className="h-full w-full bg-[var(--chat-text)]" />
        )}
        <PlayOverlay label={item.altText || "Open video"} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block overflow-hidden rounded-md border-0 bg-transparent p-0 transition-opacity hover:opacity-80"
      style={{ width: 72, height: 72 }}
      aria-label={item.altText || "Open image"}
    >
      <img
        src={item.url}
        alt={item.altText || "Image"}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </button>
  );
}

// Chip geometry: 12px medium text, 20px tall, 6px corners. Static class
// strings per tone so Tailwind's scanner sees every one.
const BADGE_TONE_CLASS: Record<TableBadgeTone, string> = {
  neutral: "bg-[var(--chat-tone-neutral-bg)] text-[var(--chat-tone-neutral-fg)]",
  info: "bg-[var(--chat-tone-info-bg)] text-[var(--chat-tone-info-fg)]",
  success: "bg-[var(--chat-tone-success-bg)] text-[var(--chat-tone-success-fg)]",
  warning: "bg-[var(--chat-tone-warning-bg)] text-[var(--chat-tone-warning-fg)]",
  danger: "bg-[var(--chat-tone-danger-bg)] text-[var(--chat-tone-danger-fg)]",
};

/** A state (known tone) is a dot and its label; anything else is a neutral label. */
function TableBadge({ value }: { value: unknown }) {
  const tone = tableBadgeTone(value);
  return (
    <span
      data-tone={tone ?? "neutral"}
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-md px-1.5 align-middle text-xs font-medium leading-4",
        BADGE_TONE_CLASS[tone ?? "neutral"],
      )}
    >
      {tone && (
        <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-current" />
      )}
      <span className="min-w-0 truncate">{String(value)}</span>
    </span>
  );
}

const LINK_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);
// File names look like bare domains ("report.pdf"); they stay text. Same
// list as the web table's safeExternalHref.
const FILE_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "csv",
  "json",
  "xml",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "mp4",
  "mov",
  "zip",
  "md",
]);

function looksLikeBareDomain(text: string): boolean {
  const match = text.match(
    /^([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d{1,5})?(?:[/?#].*)?$/i,
  );
  if (!match) return false;
  const tld = match[1].split(".").pop()!.toLowerCase();
  return /^[a-z]{2,24}$/.test(tld) && !FILE_EXTENSIONS.has(tld);
}

/**
 * The href a "link" column value opens, or null when it must stay plain
 * text. Links are absolute http(s), mailto and tel URLs, in-app paths
 * starting with a single "/", and bare domains ("www.facebook.com/x", upgraded
 * to https). Anything else, such as a bare word the model wrote
 * ("unavailable"), would resolve against the current page and open a dead
 * route (V3-BUG-070). Executable schemes such as javascript: are rejected.
 */
export function tableLinkHref(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const text = url.trim();
  if (!text) return null;
  if (text.startsWith("/")) {
    // "//host" and "/\host" leave the app.
    return /^\/[/\\]/.test(text) ? null : text;
  }
  const candidate =
    !/\s/.test(text) && looksLikeBareDomain(text) ? `https://${text}` : text;
  try {
    const parsed = new URL(candidate);
    if (!LINK_PROTOCOLS.has(parsed.protocol)) return null;
    if (
      (parsed.protocol === "mailto:" || parsed.protocol === "tel:") &&
      !parsed.pathname
    )
      return null;
    return candidate === text ? text : parsed.href;
  } catch {
    return null;
  }
}

function formatCellValue(value: unknown, column: TableColumn): React.ReactNode {
  if (value === null || value === undefined)
    return <span className="text-[var(--chat-text-subtle)]">-</span>;

  const type = column.type || "string";

  switch (type as TableColumnType) {
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "currency":
      return typeof value === "number"
        ? new Intl.NumberFormat(
            "en-US",
            column.currencyCode
              ? { style: "currency", currency: column.currencyCode }
              : {},
          ).format(value)
        : String(value);
    case "date":
      try {
        return new Date(value as string | number).toLocaleDateString();
      } catch {
        return String(value);
      }
    case "badge":
      return <TableBadge value={value} />;
    case "link": {
      const link =
        typeof value === "object" ? (value as Record<string, unknown>) : null;
      const url = typeof value === "string" ? value : link?.url;
      const label =
        typeof link?.label === "string"
          ? link.label
          : typeof url === "string"
            ? url
            : "Link unavailable";
      const href = tableLinkHref(url);
      if (!href) return <span>{label}</span>;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 dark:text-blue-400 hover:underline"
        >
          {label}
        </a>
      );
    }
    case "boolean":
      return value ? (
        <Check size={18} className="text-[var(--chat-tone-success-fg)]" />
      ) : (
        <X size={18} className="text-[var(--chat-text-subtle)]" />
      );
    case "progress": {
      const numValue =
        typeof value === "number" ? value : parseFloat(String(value));
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-[var(--chat-tone-neutral-bg)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--chat-primary)] rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, numValue))}%` }}
            />
          </div>
          <span className="text-xs text-[var(--chat-text-subtle)]">{numValue.toFixed(0)}%</span>
        </div>
      );
    }
    default:
      // A string cell may name host objects by id (a table of schedules
      // carries `sched_…` in its rows); those render as entity chips.
      // Markdown links to http(s) URLs render as anchors (V3-BUG-320).
      return typeof value === "string" ? (
        <TableCellText>{value}</TableCellText>
      ) : (
        String(value)
      );
  }
}

export function TableVisualization({
  data,
  config,
  medias,
}: TableVisualizationProps) {
  const { columns, rows } = data;
  const hasMedia = columns.some((col) => col.type === "media");
  const sortable = config?.sortable !== false;
  const paginated = config?.paginated || false;
  const pageSize = config?.pageSize || 10;

  const [order, setOrder] = useState<Order>("asc");
  const [orderBy, setOrderBy] = useState<string>("");
  const [page, setPage] = useState(0);

  const handleRequestSort = (key: string) => {
    if (orderBy === key && order === "desc") setOrderBy("");
    else {
      setOrder(orderBy === key ? "desc" : "asc");
      setOrderBy(key);
    }
    setPage(0);
  };

  const processedRows = useMemo(() => {
    let sorted = [...rows];
    if (sortable && orderBy) {
      sorted.sort((a, b) =>
        compareTableValues(
          a[orderBy],
          b[orderBy],
          order,
          columns.find((column) => column.key === orderBy)?.type,
        ),
      );
    }
    if (paginated)
      sorted = sorted.slice(page * pageSize, (page + 1) * pageSize);
    return sorted;
  }, [rows, columns, order, orderBy, page, pageSize, sortable, paginated]);

  const totalPages = Math.ceil(rows.length / pageSize);

  // Collect every media cell on the currently-visible page into a flat list
  // so the lightbox can navigate across rows (and columns, if multiple media
  // columns exist). Each entry carries its (rowIdx, colKey) so a click on a
  // specific cell jumps to the right index.
  const mediaIndex = useMemo(() => {
    const items: MediaItem[] = [];
    const lookup: Record<string, number> = {}; // `${rowIdx}::${colKey}` → items idx
    const mediaColumns = columns.filter((c) => c.type === "media");
    if (mediaColumns.length === 0) return { items, lookup };
    processedRows.forEach((row, rowIdx) => {
      mediaColumns.forEach((col) => {
        const cell = row[col.key];
        const parsed = parseMediaValue(cell, `${col.key}-${rowIdx}`, medias);
        if (parsed) {
          lookup[`${rowIdx}::${col.key}`] = items.length;
          items.push(parsed);
        }
      });
    });
    return { items, lookup };
  }, [processedRows, columns, medias]);

  const {
    index: lightboxIndex,
    open: openLightbox,
    close: closeLightbox,
    navigate: navigateLightbox,
  } = useMediaLightbox(mediaIndex.items);

  // Per-cell hover popover. The popover is interactive (selectable text +
  // Copy button), so we debounce both show and hide so that:
  //   - fast pointer movements don't flash a popover
  //   - moving cursor from cell to popover doesn't dismiss before arrival
  // Timers are cleared when the cursor enters the popover (keep open) and
  // rescheduled when the cursor leaves either the cell or the popover.
  const [hoveredCell, setHoveredCell] = useState<{
    rowIdx: number;
    colKey: string;
    rect: DOMRect;
  } | null>(null);

  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const cancelShowTimer = () => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };
  const cancelHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleShow = (rowIdx: number, colKey: string, rect: DOMRect) => {
    cancelShowTimer();
    cancelHideTimer();
    showTimerRef.current = window.setTimeout(() => {
      setHoveredCell({ rowIdx, colKey, rect });
      showTimerRef.current = null;
    }, 250);
  };
  const scheduleHide = () => {
    cancelShowTimer();
    cancelHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHoveredCell(null);
      hideTimerRef.current = null;
    }, 150);
  };
  const keepOpen = () => {
    cancelHideTimer();
  };

  // Clean up timers on unmount and when lightbox opens (avoid stale popover
  // on top of a modal).
  useEffect(() => {
    return () => {
      cancelShowTimer();
      cancelHideTimer();
    };
  }, []);
  useEffect(() => {
    if (lightboxIndex !== null) {
      cancelShowTimer();
      cancelHideTimer();
      setHoveredCell(null);
    }
  }, [lightboxIndex]);

  const hoveredCol =
    hoveredCell && columns.find((c) => c.key === hoveredCell.colKey);
  const hoveredText =
    hoveredCell && hoveredCol
      ? _cellToText(processedRows[hoveredCell.rowIdx]?.[hoveredCell.colKey])
      : "";

  return (
    <div
      className="w-full min-w-0 max-w-full overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="Data table"
    >
      <table
        className={cn("min-w-full border-collapse text-sm", hasMedia && "w-full table-fixed")}
        style={{ minWidth: hasMedia ? 640 : undefined }}
      >
        <colgroup>
          {columns.map((col) => (
            <col
              key={col.key}
              style={{
                width: col.width || (col.type === "media" ? 120 : undefined),
              }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                // The table recipe: no header slab, muted 12px medium label in
                // normal case, one rule beneath.
                className={cn(
                  "px-3 py-2 align-bottom text-xs font-medium leading-4 normal-case whitespace-normal break-words text-left",
                  "text-[var(--chat-table-header-ink,var(--chat-text-subtle))]",
                  "border-b border-[var(--chat-table-rule,color-mix(in_srgb,var(--chat-text)_10%,transparent))]",
                  // Media columns aren't sortable in a meaningful way.
                  sortable && col.type !== "media" && "select-none",
                )}
                style={{
                  width: col.width,
                  textAlign:
                    col.align ||
                    (["number", "currency", "progress"].includes(col.type || "")
                      ? "right"
                      : "left"),
                }}
                // Only the sorted header carries aria-sort (WAI-ARIA: one at a time).
                aria-sort={
                  orderBy === col.key ? (order === "asc" ? "ascending" : "descending") : undefined
                }
              >
                <button
                  type="button"
                  disabled={!sortable || col.type === "media"}
                  onClick={() => handleRequestSort(col.key)}
                  aria-label={`${col.label}: ${orderBy === col.key ? (order === "asc" ? "sort descending" : "clear sort") : "sort ascending"}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded border-0 bg-transparent p-0 text-inherit [font:inherit] focus-visible:outline focus-visible:outline-2 disabled:cursor-default",
                    "enabled:cursor-pointer enabled:hover:text-[var(--chat-text)]",
                    orderBy === col.key && "text-[var(--chat-text)]",
                  )}
                >
                  {col.label}
                  {sortable &&
                    col.type !== "media" &&
                    orderBy === col.key &&
                    (order === "asc" ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    ))}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedRows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-t border-[var(--chat-table-rule,color-mix(in_srgb,var(--chat-text)_10%,transparent))] first:border-t-0 hover:bg-[color-mix(in_srgb,var(--chat-text)_3%,transparent)]"
            >
              {columns.map((col) => {
                if (col.type === "media") {
                  const parsed = parseMediaValue(
                    row[col.key],
                    `${col.key}-${rowIdx}`,
                    medias,
                  );
                  return (
                    <td
                      key={col.key}
                      className="px-3 py-2 align-middle"
                      style={{ textAlign: col.align || "left" }}
                    >
                      {parsed ? (
                        <div className="flex flex-col items-start gap-1">
                          <MediaCell
                            item={parsed}
                            onOpen={() => {
                              const idx =
                                mediaIndex.lookup[`${rowIdx}::${col.key}`];
                              if (typeof idx === "number") openLightbox(idx);
                            }}
                          />
                          {parsed.previewUrl &&
                            /^https?:\/\//.test(parsed.previewUrl) && (
                              <a
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                href={parsed.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open in Meta
                              </a>
                            )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--chat-text-subtle)]">
                          Preview unavailable
                        </span>
                      )}
                    </td>
                  );
                }
                const nowrap = _NOWRAP_TYPES.has(
                  (col.type || "string") as TableColumnType,
                );
                const cellText = _cellToText(row[col.key]);
                return (
                  <td
                    key={col.key}
                    // max-w caps the column width but stays on the td so table
                    // layout is preserved. Critically, do NOT put
                    // `display: -webkit-box` on the td itself — that kills
                    // `display: table-cell` and breaks all columns to the
                    // right. The wrap/line-clamp treatment lives on an inner
                    // div instead.
                    className={cn(
                      "px-3 py-2 align-top",
                      nowrap ? "max-w-[300px]" : "max-w-[320px]",
                    )}
                    style={{
                      textAlign:
                        col.align ||
                        (["number", "currency", "progress"].includes(
                          col.type || "",
                        )
                          ? "right"
                          : "left"),
                      fontVariantNumeric: "tabular-nums",
                    }}
                    tabIndex={0}
                    onFocus={(e) => {
                      if (cellText)
                        scheduleShow(
                          rowIdx,
                          col.key,
                          e.currentTarget.getBoundingClientRect(),
                        );
                    }}
                    onBlur={() => scheduleHide()}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") scheduleHide();
                      if (
                        (e.ctrlKey || e.metaKey) &&
                        e.key === "c" &&
                        !window.getSelection()?.toString()
                      ) {
                        e.preventDefault();
                        void navigator.clipboard
                          .writeText(cellText)
                          .catch(() => {});
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!cellText) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      scheduleShow(rowIdx, col.key, rect);
                    }}
                    onMouseLeave={() => {
                      scheduleHide();
                    }}
                  >
                    {nowrap ? (
                      <div className="overflow-hidden whitespace-nowrap text-ellipsis">
                        {formatCellValue(row[col.key], col)}
                      </div>
                    ) : (
                      <div className="whitespace-normal break-words [overflow-wrap:anywhere]">
                        {formatCellValue(row[col.key], col)}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {processedRows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-[var(--chat-text-subtle)]"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {hoveredCell && hoveredCol && lightboxIndex === null && (
        <CellHoverPopover
          text={hoveredText}
          anchorRect={hoveredCell.rect}
          onEnter={keepOpen}
          onLeave={scheduleHide}
        />
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          origin="table"
          items={mediaIndex.items}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}

      <div className="px-3 py-1 text-xs text-[var(--chat-text-subtle)]">
        Sorting applies to the rows in this response.
      </div>
      {paginated && rows.length > pageSize && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--chat-table-rule,color-mix(in_srgb,var(--chat-text)_10%,transparent))] text-sm">
          <span className="text-[var(--chat-text-subtle)]">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, rows.length)}{" "}
            of {rows.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded hover:bg-[color-mix(in_srgb,var(--chat-text)_6%,transparent)] disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded hover:bg-[color-mix(in_srgb,var(--chat-text)_6%,transparent)] disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
