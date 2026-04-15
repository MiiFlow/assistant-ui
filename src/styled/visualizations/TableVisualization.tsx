import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X, ChevronUp, ChevronDown, Copy as CopyIcon } from "lucide-react";
import { cn } from "../../utils/cn";
import type { MediaChunkData, TableVisualizationData, TableColumn, TableColumnType, VisualizationConfig } from "../../types";
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
  if (typeof value === "number" || typeof value === "boolean") return String(value);
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
        "relative overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg",
        "dark:border-gray-700 dark:bg-gray-900",
      )}
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        className={cn(
          "select-text overflow-auto px-2.5 py-1.5 pr-8 text-sm text-gray-900 dark:text-gray-100",
          "whitespace-pre-wrap break-words",
        )}
        style={{ maxHeight: "50vh" }}
      >
        {text || <span className="text-gray-400">—</span>}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy"}
        title={copied ? "Copied" : "Copy"}
        className={cn(
          "absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center",
          "rounded text-gray-500 transition-colors",
          "hover:bg-gray-100 hover:text-gray-800",
          "dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
        )}
      >
        {copied ? <Check size={12} /> : <CopyIcon size={12} />}
      </button>
    </div>,
    document.body,
  );
}

/** Inline media cell: clickable thumbnail that opens the table-wide lightbox. */
function MediaCell({
  item,
  onOpen,
}: {
  item: MediaItem;
  onOpen: () => void;
}) {
  if (item.mediaType === "video") {
    const ytMatch = item.url.match(YOUTUBE_ID_RE);
    const ytId = ytMatch ? ytMatch[1] : null;
    const posterSrc = ytId
      ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
      : undefined;
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
          <div className="flex h-full w-full items-center justify-center bg-gray-900 text-[10px] text-gray-400">
            Video
          </div>
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

const badgeColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  success: "bg-green-100 text-green-700",
  enabled: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
  disabled: "bg-red-100 text-red-700",
  inactive: "bg-gray-100 text-gray-700",
  draft: "bg-gray-100 text-gray-700",
};

function formatCellValue(value: unknown, column: TableColumn): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-gray-400">-</span>;

  const type = column.type || "string";

  switch (type as TableColumnType) {
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "currency":
      return typeof value === "number"
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
        : String(value);
    case "date":
      try { return new Date(value as string | number).toLocaleDateString(); }
      catch { return String(value); }
    case "badge": {
      const strValue = String(value).toLowerCase().replace(/\s+/g, "_");
      const colorClass = badgeColors[strValue] || "bg-gray-100 text-gray-700";
      return <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", colorClass)}>{String(value)}</span>;
    }
    case "link":
      return <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{String(value)}</a>;
    case "boolean":
      return value ? <Check size={18} className="text-green-500" /> : <X size={18} className="text-gray-400" />;
    case "progress": {
      const numValue = typeof value === "number" ? value : parseFloat(String(value));
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, numValue))}%` }} />
          </div>
          <span className="text-xs text-gray-500">{numValue.toFixed(0)}%</span>
        </div>
      );
    }
    default:
      return String(value);
  }
}

function descendingComparator(a: Record<string, unknown>, b: Record<string, unknown>, orderBy: string): number {
  const aValue = a[orderBy];
  const bValue = b[orderBy];
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  if (typeof aValue === "number" && typeof bValue === "number") return bValue - aValue;
  return String(bValue).localeCompare(String(aValue));
}

export function TableVisualization({ data, config, medias }: TableVisualizationProps) {
  const { columns, rows } = data;
  const sortable = config?.sortable !== false;
  const paginated = config?.paginated || false;
  const pageSize = config?.pageSize || 10;

  const [order, setOrder] = useState<Order>("asc");
  const [orderBy, setOrderBy] = useState<string>(columns[0]?.key || "");
  const [page, setPage] = useState(0);

  const handleRequestSort = (key: string) => {
    setOrder(orderBy === key && order === "asc" ? "desc" : "asc");
    setOrderBy(key);
  };

  const processedRows = useMemo(() => {
    let sorted = [...rows];
    if (sortable && orderBy) {
      sorted.sort((a, b) => order === "desc" ? descendingComparator(a, b, orderBy) : -descendingComparator(a, b, orderBy));
    }
    if (paginated) sorted = sorted.slice(page * pageSize, (page + 1) * pageSize);
    return sorted;
  }, [rows, order, orderBy, page, pageSize, sortable, paginated]);

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
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-3 py-2 font-semibold bg-gray-50 dark:bg-gray-800 whitespace-nowrap text-left",
                  // Media columns aren't sortable in a meaningful way.
                  sortable && col.type !== "media" &&
                    "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700",
                )}
                style={{ width: col.width, textAlign: col.align || "left" }}
                onClick={() =>
                  sortable && col.type !== "media" && handleRequestSort(col.key)
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortable && col.type !== "media" && orderBy === col.key && (
                    order === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedRows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
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
                        <MediaCell
                          item={parsed}
                          onOpen={() => {
                            const idx = mediaIndex.lookup[`${rowIdx}::${col.key}`];
                            if (typeof idx === "number") openLightbox(idx);
                          }}
                        />
                      ) : (
                        <span className="text-gray-400">-</span>
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
                    style={{ textAlign: col.align || "left" }}
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
                      <div className="whitespace-normal break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
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
              <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">
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
          items={mediaIndex.items}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}

      {paginated && rows.length > pageSize && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-sm">
          <span className="text-gray-500">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
