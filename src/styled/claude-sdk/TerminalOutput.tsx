import { useState } from "react";
import { ChevronDown, ChevronRight, Terminal, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";
import type { StreamingChunk } from "../../types";

export interface TerminalOutputProps {
  chunk: StreamingChunk;
}

export function TerminalOutput({ chunk }: TerminalOutputProps) {
  const [expanded, setExpanded] = useState(true);

  const data = chunk.terminalData;
  if (!data) return null;

  const getStatusIcon = () => {
    switch (data.status) {
      case "running":
        return <Loader2 size={14} className="animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 size={14} className="text-green-500" />;
      case "failed":
        return <XCircle size={14} className="text-red-500" />;
      default:
        return null;
    }
  };

  const statusBorderColor =
    data.status === "running" ? "border-blue-500/30" :
    data.status === "failed" ? "border-red-500/30" :
    data.exitCode === 0 ? "border-green-500/30" : "border-yellow-500/30";

  const statusBgColor =
    data.status === "running" ? "bg-blue-500/10" :
    data.status === "failed" ? "bg-red-500/10" :
    "bg-green-500/10";

  const statusColor =
    data.status === "running" ? "text-blue-500" :
    data.status === "failed" ? "text-red-500" :
    "text-green-500";

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    if (ms < 1000) return ms + "ms";
    return (ms / 1000).toFixed(1) + "s";
  };

  return (
    <div className={cn("my-1 bg-[#1a1a1a] rounded border", statusBorderColor, "overflow-hidden")}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer", statusBgColor, "hover:brightness-110")}
      >
        <span className="p-0.5 text-gray-500">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <Terminal size={16} className={statusColor} />
        <span className="flex-1 font-mono text-[0.75rem] text-gray-300 truncate">
          <span className="text-gray-500">$ </span>
          {data.command}
        </span>
        {data.durationMs != null && (
          <span className="text-[0.7rem] text-gray-600">{formatDuration(data.durationMs)}</span>
        )}
        {getStatusIcon()}
        {data.status !== "running" && data.exitCode !== undefined && (
          <span className={cn("text-[0.7rem] font-mono", data.exitCode === 0 ? "text-green-500" : "text-red-500")}>
            [{data.exitCode}]
          </span>
        )}
      </div>

      {expanded && (
        <div className="p-3">
          {data.description && (
            <p className="text-gray-500 text-[0.75rem] italic mb-2">{data.description}</p>
          )}
          {data.stdout && (
            <pre className={cn(
              "m-0 p-2 text-[0.7rem] font-mono bg-[#0d0d0d] rounded overflow-auto max-h-[300px]",
              "text-green-400 whitespace-pre-wrap break-words",
              data.stderr && "mb-2"
            )}>
              {data.stdout}
            </pre>
          )}
          {data.stderr && (
            <pre className="m-0 p-2 text-[0.7rem] font-mono bg-red-500/10 rounded border border-red-500/30 overflow-auto max-h-[200px] text-red-400 whitespace-pre-wrap break-words">
              {data.stderr}
            </pre>
          )}
          {data.status === "running" && !data.stdout && !data.stderr && (
            <p className="text-gray-500 text-[0.75rem] italic">Running...</p>
          )}
          {data.status === "completed" && !data.stdout && !data.stderr && data.exitCode === 0 && (
            <p className="text-gray-600 text-[0.75rem] italic">Command completed with no output</p>
          )}
        </div>
      )}
    </div>
  );
}
