import { useState } from "react";
import { ChevronDown, ChevronRight, GitBranch, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";
import type { StreamingChunk } from "../../types";

export interface SubagentPanelProps {
  chunk: StreamingChunk;
}

const TYPE_LABELS: Record<string, string> = {
  code_reviewer: "Code Review",
  researcher: "Research",
  data_analyst: "Data Analysis",
  Explore: "Explore",
  Plan: "Planning",
  Bash: "Command Execution",
};

export function SubagentPanel({ chunk }: SubagentPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const data = chunk.subagentData;
  if (!data) return null;

  const statusIcon =
    data.status === "running" ? <Loader2 size={16} className="animate-spin text-blue-500" /> :
    data.status === "completed" ? <CheckCircle2 size={16} className="text-green-500" /> :
    data.status === "failed" ? <XCircle size={16} className="text-red-500" /> : null;

  const statusColor =
    data.status === "running" ? "border-blue-500" :
    data.status === "completed" ? "border-green-500" :
    data.status === "failed" ? "border-red-500" : "border-gray-500";

  const statusBg =
    data.status === "running" ? "bg-blue-500/3" :
    data.status === "completed" ? "bg-green-500/3" :
    data.status === "failed" ? "bg-red-500/3" : "bg-gray-500/3";

  const chipColor =
    data.status === "running" ? "bg-blue-500/10 text-blue-500" :
    data.status === "completed" ? "bg-green-500/10 text-green-500" :
    data.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-gray-500/10 text-gray-500";

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  };

  const label = TYPE_LABELS[data.subagentType] || data.subagentType;

  return (
    <div className={cn("border border-dashed rounded ml-4 my-2 overflow-hidden", statusColor + "/50", statusBg)}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:brightness-95")}
      >
        <span className="p-0.5">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
        <GitBranch size={16} className={statusColor.replace("border-", "text-")} />
        <span className={cn("text-[0.75rem] px-2 py-0.5 rounded font-medium", chipColor)}>
          {label}
        </span>
        <span className="flex-1 text-sm text-gray-500 truncate">{data.description}</span>
        {statusIcon}
        {data.durationMs != null && (
          <span className="text-[0.7rem] text-gray-400">{formatDuration(data.durationMs)}</span>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          {data.nestedChunks && data.nestedChunks.length > 0 && (
            <div className="mt-2 space-y-1">
              {data.nestedChunks.map((nestedChunk, idx) => (
                <NestedChunkRenderer key={idx} chunk={nestedChunk} />
              ))}
            </div>
          )}
          {data.status === "completed" && data.result && (
            <div className="mt-2 p-2 rounded bg-green-500/5 border border-green-500/20">
              <span className="text-[0.75rem] font-medium text-green-500">Result</span>
              <p className="mt-1 text-sm text-gray-500 whitespace-pre-wrap">
                {data.result.length > 500 ? data.result.slice(0, 500) + "..." : data.result}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NestedChunkRenderer({ chunk }: { chunk: StreamingChunk }) {
  if (chunk.type === "tool" || chunk.type === "observation") {
    return (
      <div className="py-1 px-2 my-1 rounded bg-blue-500/5 text-[0.75rem]">
        <span className="font-medium text-blue-500">{chunk.toolName || "Tool"}:</span>{" "}
        <span className="text-gray-500">
          {chunk.content?.slice(0, 200) || chunk.toolDescription || "Executing..."}
          {chunk.content && chunk.content.length > 200 && "..."}
        </span>
      </div>
    );
  }

  if (chunk.type === "thinking" || chunk.type === "claude_thinking") {
    return (
      <p className="py-1 text-[0.75rem] text-gray-400 italic">
        {chunk.content?.slice(0, 150)}
        {chunk.content && chunk.content.length > 150 && "..."}
      </p>
    );
  }

  return null;
}
