import { useState, useEffect } from "react";
import { ExternalLink, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../utils/cn";
import type { SourceReference, SourceTypeConfig, MemoryFeedbackType } from "../types";
import { isMemoryCitation } from "../types";

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
  onMemoryFeedback?: (semanticAtomId: string, feedback: MemoryFeedbackType) => void;
  memoryFeedbackState?: Record<string, MemoryFeedbackType>;
}

/**
 * Renders citation sources as a horizontal row of clickable chips.
 * Clicking a chip opens a modal showing full source content.
 * Memory citations include feedback buttons (thumbs up/down).
 */
export function CitationSources({
  sources,
  className,
  onMemoryFeedback,
  memoryFeedbackState,
}: CitationSourcesProps) {
  const [selectedSource, setSelectedSource] = useState<SourceReference | null>(null);
  const [localFeedback, setLocalFeedback] = useState<Record<string, MemoryFeedbackType>>({});

  // Merge external feedback state with local state
  const feedbackState = { ...localFeedback, ...memoryFeedbackState };

  if (!sources || sources.length === 0) return null;

  const handleFeedback = (source: SourceReference, feedback: MemoryFeedbackType) => {
    const atomId = source.metadata?.semantic_atom_id as string;
    if (!atomId) return;

    const currentFeedback = feedbackState[atomId];
    if (currentFeedback === feedback) {
      // Toggle off — remove feedback
      setLocalFeedback((prev) => {
        const next = { ...prev };
        delete next[atomId];
        return next;
      });
      return;
    }

    setLocalFeedback((prev) => ({ ...prev, [atomId]: feedback }));
    onMemoryFeedback?.(atomId, feedback);
  };

  // Determine if we need to show overflow
  const MAX_VISIBLE = 8;
  const [showAll, setShowAll] = useState(false);
  const visibleSources = showAll ? sources : sources.slice(0, MAX_VISIBLE);
  const hiddenCount = sources.length - MAX_VISIBLE;

  return (
    <>
      <div className={cn("flex flex-wrap gap-1.5 mt-2", className)}>
        {visibleSources.map((source) => {
          const typeDisplay = getSourceTypeDisplay(source.source_type);
          const isMem = isMemoryCitation(source);
          const atomId = source.metadata?.semantic_atom_id as string | undefined;
          const currentFeedback = atomId ? feedbackState[atomId] : undefined;

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
              {isMem && atomId && onMemoryFeedback && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFeedback(source, "relevant");
                    }}
                    className={cn(
                      "inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors",
                      currentFeedback === "relevant"
                        ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                        : "text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20",
                    )}
                    title="Relevant memory"
                  >
                    <ThumbsUp size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFeedback(source, "not_relevant");
                    }}
                    className={cn(
                      "inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors",
                      currentFeedback === "not_relevant"
                        ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                        : "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20",
                    )}
                    title="Not relevant memory"
                  >
                    <ThumbsDown size={11} />
                  </button>
                </>
              )}
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
        onMemoryFeedback={onMemoryFeedback}
        feedbackState={feedbackState}
        onFeedbackChange={handleFeedback}
      />
    </>
  );
}

export interface SourceDetailModalProps {
  source: SourceReference | null;
  onClose: () => void;
  onMemoryFeedback?: (semanticAtomId: string, feedback: MemoryFeedbackType) => void;
  feedbackState?: Record<string, MemoryFeedbackType>;
  onFeedbackChange?: (source: SourceReference, feedback: MemoryFeedbackType) => void;
}

export function SourceDetailModal({
  source,
  onClose,
  onMemoryFeedback,
  feedbackState = {},
  onFeedbackChange,
}: SourceDetailModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!source) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [source, onClose]);

  if (!source) return null;

  const typeDisplay = getSourceTypeDisplay(source.source_type);
  const isMem = isMemoryCitation(source);
  const atomId = source.metadata?.semantic_atom_id as string | undefined;
  const currentFeedback = atomId ? feedbackState[atomId] : undefined;

  return (
    <AnimatePresence>
      {source && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
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

              {/* Full content or snippet */}
              {source.full_content ? (
                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 max-h-[400px] overflow-auto">
                  {source.full_content}
                </div>
              ) : source.snippet ? (
                <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                  {source.snippet}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No content available for this source.</p>
              )}

              {/* Memory feedback buttons (larger, in modal view) */}
              {isMem && atomId && onMemoryFeedback && onFeedbackChange && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-gray-500">Was this memory helpful?</span>
                  <button
                    onClick={() => onFeedbackChange(source, "relevant")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                      currentFeedback === "relevant"
                        ? "bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                        : "text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-600 dark:border-gray-700 dark:hover:bg-green-900/20",
                    )}
                  >
                    <ThumbsUp size={14} />
                    Relevant
                  </button>
                  <button
                    onClick={() => onFeedbackChange(source, "not_relevant")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors",
                      currentFeedback === "not_relevant"
                        ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
                        : "text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:hover:bg-red-900/20",
                    )}
                  >
                    <ThumbsDown size={14} />
                    Not relevant
                  </button>
                </div>
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
    </AnimatePresence>
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
