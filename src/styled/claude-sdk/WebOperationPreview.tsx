import { useState } from "react";
import { Globe, Search, ExternalLink, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../utils/cn";
import type { StreamingChunk } from "../../types";

export interface WebOperationPreviewProps {
  chunk: StreamingChunk;
}

export function WebOperationPreview({ chunk }: WebOperationPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const data = chunk.webOperationData;
  if (!data) return null;

  const isSearch = data.operation === "search";
  const isPending = data.status === "pending";
  const isError = data.status === "error";
  const isCompleted = data.status === "completed";

  const getStatusIcon = () => {
    if (isPending) return <Loader2 size={14} className="animate-spin text-gray-400" />;
    if (isError) return <XCircle size={14} className="text-red-500" />;
    return <CheckCircle2 size={14} className="text-green-500" />;
  };

  const parseSearchResults = () => {
    if (!data.results || typeof data.results !== "string") return [];
    const urlPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const matches: { title: string; url: string }[] = [];
    let match;
    while ((match = urlPattern.exec(data.results)) !== null) {
      matches.push({ title: match[1], url: match[2] });
    }
    return matches;
  };

  const searchResults = isSearch ? parseSearchResults() : [];

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {isSearch ? (
          <Search size={16} className="text-gray-400 shrink-0" />
        ) : (
          <Globe size={16} className="text-gray-400 shrink-0" />
        )}
        <span className="flex-1 text-sm truncate">
          {isSearch ? (
            <>Searching: <span className="font-medium">{data.query}</span></>
          ) : (
            <>Fetching: <span className="font-medium">{data.url}</span></>
          )}
        </span>
        {getStatusIcon()}
        {isCompleted && data.durationMs != null && (
          <span className="text-[0.7rem] px-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded">
            {Math.round(data.durationMs)}ms
          </span>
        )}
        <span className="p-0.5">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          {isError && data.error && (
            <p className="text-sm text-red-500 font-mono">{data.error}</p>
          )}
          {isPending && (
            <p className="text-sm text-gray-400 italic">
              {isSearch ? "Searching the web..." : "Fetching content..."}
            </p>
          )}
          {isSearch && isCompleted && searchResults.length > 0 && (
            <div className="space-y-2">
              <div className="text-[0.75rem] text-gray-400 uppercase tracking-wider">
                {searchResults.length} Results
              </div>
              {searchResults.slice(0, 5).map((result, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 py-1",
                    idx < Math.min(searchResults.length, 5) - 1 && "border-b border-gray-200 dark:border-gray-700"
                  )}
                >
                  <ExternalLink size={12} className="text-gray-400 shrink-0" />
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm truncate hover:underline"
                  >
                    {result.title}
                  </a>
                </div>
              ))}
              {searchResults.length > 5 && (
                <p className="text-[0.75rem] text-gray-400 italic">
                  +{searchResults.length - 5} more results
                </p>
              )}
            </div>
          )}
          {isSearch && isCompleted && searchResults.length === 0 && data.results && (
            <p className="text-sm whitespace-pre-wrap max-h-[200px] overflow-auto">
              {typeof data.results === "string"
                ? data.results.slice(0, 1000)
                : JSON.stringify(data.results, null, 2).slice(0, 1000)}
              {data.results.length > 1000 && "..."}
            </p>
          )}
          {!isSearch && isCompleted && data.content && (
            <div className="max-h-[300px] overflow-auto bg-gray-100 dark:bg-gray-900 rounded p-2">
              <pre className="text-[0.75rem] font-mono whitespace-pre-wrap break-words m-0">
                {data.content.slice(0, 2000)}
                {data.content.length > 2000 && "\n... (truncated)"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
