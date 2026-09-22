import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../utils/cn";
import { citationTextToMarkdown, parseCitationContent } from "../utils/citation-content";
import { MarkdownContent } from "./MarkdownContent";
import type { SourceReference, SourceTypeConfig } from "../types";

function getSourceTypeDisplay(sourceType: string): SourceTypeConfig {
  switch (sourceType) {
    case "knowledge_base":
      return { label: "Knowledge Base", color: "#4caf50" };
    case "api":
      return { label: "API", color: "#2196f3" };
    case "system_tool":
      return { label: "Tool", color: "#ff9800" };
    case "mcp_tool":
      return { label: "MCP", color: "#9c27b0" };
    case "workflow":
      return { label: "Workflow", color: "#00bcd4" };
    case "memory":
      return { label: "Memory", color: "#e91e63" };
    default:
      return { label: "Source", color: "#757575" };
  }
}

export interface CitationSourcesProps {
  sources: SourceReference[];
  className?: string;
}

/**
 * Renders citation sources as a horizontal row of clickable chips.
 * Clicking a chip opens a modal showing full source content.
 */
export function CitationSources({
  sources,
  className,
}: CitationSourcesProps) {
  const [selectedSource, setSelectedSource] = useState<SourceReference | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!sources || sources.length === 0) return null;

  // Determine if we need to show overflow
  const MAX_VISIBLE = 8;
  const visibleSources = showAll ? sources : sources.slice(0, MAX_VISIBLE);
  const hiddenCount = sources.length - MAX_VISIBLE;

  return (
    <>
      <div className={cn("flex flex-wrap gap-1.5 mt-2", className)}>
        {visibleSources.map((source) => {
          const typeDisplay = getSourceTypeDisplay(source.source_type);

          return (
            <span key={source.index} className="inline-flex items-center gap-0.5">
              <button
                onClick={() => setSelectedSource(source)}
                className="inline-flex items-center h-6 px-2 text-[0.75rem] font-medium rounded-full border cursor-pointer transition-colors max-w-[280px] truncate"
                style={{
                  backgroundColor: typeDisplay.color + "1a",
                  color: typeDisplay.color,
                  borderColor: typeDisplay.color + "40",
                }}
              >
                [{source.index}] {source.title}
              </button>
            </span>
          );
        })}
        {!showAll && hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="inline-flex items-center h-6 px-2 text-[0.75rem] font-medium rounded-full border cursor-pointer transition-colors text-gray-500 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            +{hiddenCount} more
          </button>
        )}
      </div>

      <SourceDetailModal
        source={selectedSource}
        onClose={() => setSelectedSource(null)}
      />
    </>
  );
}

export interface SourceDetailModalProps {
  source: SourceReference | null;
  onClose: () => void;
}

export function SourceDetailModal({
  source,
  onClose,
}: SourceDetailModalProps) {
  const [showRaw, setShowRaw] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!source) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [source, onClose]);

  // Focus the panel on open, return focus to the chip that opened it on close,
  // and reset the raw/formatted view for each new source.
  useEffect(() => {
    if (!source) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setShowRaw(false);
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      restoreFocusRef.current?.focus();
    };
  }, [source]);

  if (!source || typeof document === "undefined") return null;

  const typeDisplay = getSourceTypeDisplay(source.source_type);
  const rawText = source.full_content ?? source.snippet ?? null;
  const parsed = source.full_content ? parseCitationContent(source.full_content) : null;
  const markdownText = parsed ? parsed.text : rawText;

  return createPortal(
    <AnimatePresence>
      {source && (
        <div
          data-chat-ui
          role="presentation"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-modal="true"
            aria-label={source.title}
            tabIndex={-1}
            className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <h3 className="text-lg font-semibold truncate">{source.title}</h3>
                <span
                  className="text-[0.7rem] px-1.5 py-0.5 rounded font-medium shrink-0"
                  style={{
                    backgroundColor: typeDisplay.color + "1a",
                    color: typeDisplay.color,
                  }}
                >
                  {typeDisplay.label}
                </span>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ml-2">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Metadata row */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-[0.7rem] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                  {source.tool_name.replace(/_/g, " ")}
                </span>
                {source.query && (
                  <span
                    className="text-[0.7rem] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 max-w-[200px] truncate"
                    title={source.query}
                  >
                    Query: {source.query.slice(0, 40)}{source.query.length > 40 ? "..." : ""}
                  </span>
                )}
              </div>

              {/* URL link */}
              {source.url && (
                <div className="mb-4">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline inline-flex items-center gap-1"
                  >
                    {source.url.length > 80 ? `${source.url.slice(0, 80)}...` : source.url}
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {/* Description */}
              {source.description && (
                <p className="text-sm text-gray-500 mb-4">{source.description}</p>
              )}

              {/* Full content or snippet. The payload renders as markdown —
                  paragraphs, bold and lists are real, and [ref:…] markers read
                  as inline-code chips. A Raw toggle keeps the untouched store
                  value one click away for debugging. */}
              {rawText ? (
                <>
                  <div className="flex justify-end mb-1.5">
                    <button
                      onClick={() => setShowRaw((v) => !v)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showRaw ? "Formatted" : "Raw"}
                    </button>
                  </div>
                  {showRaw ? (
                    <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 max-h-[400px] overflow-auto">
                      {rawText}
                    </div>
                  ) : (
                    <div className="text-sm max-h-[400px] overflow-y-auto pr-1">
                      <MarkdownContent>{citationTextToMarkdown(markdownText ?? "")}</MarkdownContent>
                    </div>
                  )}
                  {parsed && parsed.meta.length > 0 && !showRaw && (
                    <dl className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      {parsed.meta.map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="text-xs font-mono text-gray-400 dark:text-gray-500">
                            {key}
                          </dt>
                          <dd
                            className="text-xs text-gray-600 dark:text-gray-300 truncate"
                            title={value}
                          >
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">No content available for this source.</p>
              )}

            </div>

            {/* Footer */}
            <div className="flex justify-end p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Inline citation badge - renders a small numbered badge like [1]
 * with optional tooltip on hover and click-to-open URL.
 */
export interface InlineCitationProps {
  index: number;
  source?: SourceReference;
}

export function InlineCitation({ index, source }: InlineCitationProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[16px] h-4 rounded-full",
        "bg-blue-500 text-white text-[0.6rem] font-semibold",
        "px-0.5 mx-0.5 align-super",
        source?.url ? "cursor-pointer hover:opacity-85" : "cursor-default"
      )}
      title={source ? `${source.title}${source.description ? ": " + source.description : ""}` : undefined}
      onClick={(e) => {
        if (source?.url) {
          e.stopPropagation();
          window.open(source.url, "_blank", "noopener,noreferrer");
        }
      }}
    >
      {index}
    </span>
  );
}
