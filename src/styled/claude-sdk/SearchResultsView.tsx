import { useState } from "react";
import { ChevronDown, ChevronRight, FileSearch, FolderSearch, File } from "lucide-react";
import { cn } from "../../utils/cn";
import type { StreamingChunk, SearchResultItem } from "../../types";

export interface SearchResultsViewProps {
  chunk: StreamingChunk;
}

export function SearchResultsView({ chunk }: SearchResultsViewProps) {
  const [expanded, setExpanded] = useState(true);

  const data = chunk.searchResultsData;
  if (!data) return null;

  const isGrep = data.tool === "grep";
  const toolColor = isGrep ? "text-purple-500" : "text-blue-500";
  const toolBorderColor = isGrep ? "border-purple-500/30" : "border-blue-500/30";
  const toolBg = isGrep ? "bg-purple-500/5 hover:bg-purple-500/8" : "bg-blue-500/5 hover:bg-blue-500/8";
  const toolChipBg = isGrep ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500";

  return (
    <div className={cn("my-1 border rounded overflow-hidden", toolBorderColor)}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer", toolBg)}
      >
        <span className="p-0.5">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className={toolColor}>
          {isGrep ? <FileSearch size={16} /> : <FolderSearch size={16} />}
        </span>
        <span className={cn("text-[0.7rem] px-1.5 py-0.5 rounded font-medium", toolChipBg)}>
          {isGrep ? "Grep" : "Glob"}
        </span>
        <span className="flex-1 font-mono text-[0.75rem] text-gray-500 truncate">
          {data.pattern}
        </span>
        <span className={cn(
          "text-[0.7rem] px-1.5 py-0.5 rounded",
          data.totalCount > 0 ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"
        )}>
          {data.totalCount} results
        </span>
      </div>

      {expanded && (
        <div className="max-h-[300px] overflow-auto">
          {data.results.length > 0 ? (
            <div>
              {data.results.slice(0, 50).map((result, idx) => (
                <SearchResultRow key={idx} result={result} isGrep={isGrep} />
              ))}
              {data.results.length > 50 && (
                <div className="py-1 px-3">
                  <span className="text-[0.75rem] text-gray-400">
                    ... and {data.results.length - 50} more results
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3">
              <p className="text-gray-500 text-sm">No results found</p>
            </div>
          )}
          {data.error && (
            <div className="p-3">
              <p className="text-red-500 text-sm">Error: {data.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultRow({ result, isGrep }: { result: SearchResultItem; isGrep: boolean }) {
  const formatPath = (path: string) => {
    const parts = path.split("/");
    if (parts.length <= 4) return path;
    return ".../" + parts.slice(-4).join("/");
  };

  return (
    <div className="flex items-start gap-2 py-1 px-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <File size={14} className="text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.75rem] truncate">{formatPath(result.filePath)}</span>
          {isGrep && result.lineNumber != null && (
            <span className="font-mono text-[0.7rem] text-blue-500">:{result.lineNumber}</span>
          )}
        </div>
        {result.snippet && (
          <p className="font-mono text-[0.7rem] text-gray-500 truncate max-w-[400px]">
            {result.snippet}
          </p>
        )}
      </div>
    </div>
  );
}
