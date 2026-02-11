import { useState } from "react";
import { Wrench, ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { StreamingChunk } from "../../types";

export interface ClaudeToolPreviewProps {
  chunk: StreamingChunk;
}

export function ClaudeToolPreview({ chunk }: ClaudeToolPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const data = chunk.claudeToolData;
  if (!data) return null;

  const isPending = data.status === "pending";
  const isError = data.status === "error";
  const isCompleted = data.status === "completed";

  const getStatusIcon = () => {
    if (isPending) return <Loader2 size={14} className="animate-spin text-gray-400" />;
    if (isError) return <XCircle size={14} className="text-red-500" />;
    return <CheckCircle2 size={14} className="text-green-500" />;
  };

  const getDisplayName = () => {
    const name = data.toolName;
    if (name.startsWith("mcp__")) {
      const parts = name.split("__");
      if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
    }
    return name;
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Wrench size={16} className="text-gray-400 shrink-0" />
        <span className="flex-1 text-sm truncate">
          <span className="font-medium">{getDisplayName()}</span>
          {data.toolDescription && (
            <span className="text-gray-400 ml-2">{data.toolDescription}</span>
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
          {data.toolInput && Object.keys(data.toolInput).length > 0 && (
            <div className="mb-3">
              <div className="text-[0.75rem] text-gray-400 uppercase tracking-wider mb-1">Input</div>
              <pre className="text-[0.75rem] font-mono bg-gray-100 dark:bg-gray-900 rounded p-2 overflow-auto max-h-[150px] m-0">
                {JSON.stringify(data.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {isError && (
            <p className="text-sm text-red-500 font-mono">{data.content || "Tool execution failed"}</p>
          )}
          {isPending && (
            <p className="text-sm text-gray-400 italic">Executing tool...</p>
          )}
          {isCompleted && data.content && !data.isError && (
            <div>
              <div className="text-[0.75rem] text-gray-400 uppercase tracking-wider mb-1">Result</div>
              <pre className="text-[0.75rem] font-mono bg-gray-100 dark:bg-gray-900 rounded p-2 overflow-auto max-h-[200px] whitespace-pre-wrap break-words m-0">
                {data.content.length > 1500 ? `${data.content.slice(0, 1500)}\n... (truncated)` : data.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
