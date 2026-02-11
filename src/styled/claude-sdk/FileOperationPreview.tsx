import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Eye, Save, Pencil, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "../../utils/cn";
import type { StreamingChunk } from "../../types";

export interface FileOperationPreviewProps {
  chunk: StreamingChunk;
}

export function FileOperationPreview({ chunk }: FileOperationPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  const data = chunk.fileOperationData;
  if (!data) return null;

  const opIcon = data.operation === "read" ? <Eye size={16} /> :
    data.operation === "write" ? <Save size={16} /> :
    data.operation === "edit" ? <Pencil size={16} /> :
    <FileText size={16} />;

  const opColor = data.operation === "read" ? "text-blue-500 border-blue-500" :
    data.operation === "write" ? "text-green-500 border-green-500" :
    data.operation === "edit" ? "text-yellow-500 border-yellow-500" :
    "text-gray-500 border-gray-500";

  const opBg = data.operation === "read" ? "bg-blue-500/5 hover:bg-blue-500/8" :
    data.operation === "write" ? "bg-green-500/5 hover:bg-green-500/8" :
    data.operation === "edit" ? "bg-yellow-500/5 hover:bg-yellow-500/8" :
    "bg-gray-500/5";

  const statusIcon = data.status === "pending" ? <Clock size={14} className="text-gray-400" /> :
    data.status === "completed" ? <CheckCircle2 size={14} className="text-green-500" /> :
    <XCircle size={14} className="text-red-500" />;

  const opLabel = data.operation === "read" ? "Read" :
    data.operation === "write" ? "Write" :
    data.operation === "edit" ? "Edit" : "File";

  const formatPath = (path: string) => {
    const parts = path.split("/");
    if (parts.length <= 3) return path;
    return ".../" + parts.slice(-3).join("/");
  };

  return (
    <div className={cn("my-1 border rounded overflow-hidden", opColor.split(" ")[1] + "/30")}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer", opBg)}
      >
        <span className="p-0.5">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className={opColor.split(" ")[0]}>{opIcon}</span>
        <span className={cn("font-medium text-[0.75rem]", opColor.split(" ")[0])}>{opLabel}</span>
        <span className="flex-1 font-mono text-[0.75rem] text-gray-500 truncate">
          {formatPath(data.filePath)}
        </span>
        {data.totalLines != null && (
          <span className="text-[0.7rem] text-gray-400">{data.totalLines} lines</span>
        )}
        {statusIcon}
      </div>

      {expanded && (
        <div className="p-3 bg-gray-50 dark:bg-[#1e1e1e]">
          {data.operation === "read" && data.content && (
            <FileContent content={data.content} />
          )}
          {data.operation === "edit" && (
            <DiffView oldString={data.oldString} newString={data.newString} />
          )}
          {data.operation === "write" && data.status === "completed" && (
            <p className="text-green-500 text-sm">File written successfully</p>
          )}
          {data.error && (
            <p className="text-red-500 text-sm">Error: {data.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function FileContent({ content }: { content: string }) {
  const lines = useMemo(() => content.split("\n").slice(0, 50), [content]);
  const totalLines = content.split("\n").length;
  const truncated = totalLines > 50;

  return (
    <div>
      <pre className="m-0 p-2 text-[0.75rem] font-mono bg-gray-100 dark:bg-[#1a1a1a] rounded overflow-auto max-h-[300px]">
        {lines.map((line, idx) => (
          <div key={idx} className="flex">
            <span className="inline-block w-10 text-right pr-3 mr-3 border-r border-gray-200 dark:border-gray-700 text-gray-400 select-none">
              {idx + 1}
            </span>
            <span>{line || " "}</span>
          </div>
        ))}
      </pre>
      {truncated && (
        <p className="text-[0.75rem] text-gray-400 mt-1">... and {totalLines - 50} more lines</p>
      )}
    </div>
  );
}

function DiffView({ oldString, newString }: { oldString?: string; newString?: string }) {
  if (!oldString && !newString) {
    return <p className="text-gray-500 text-sm">No changes to display</p>;
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <span className="text-[0.75rem] font-medium text-red-500 block mb-1">- Removed</span>
        <pre className="m-0 p-2 text-[0.7rem] font-mono bg-red-500/10 rounded border border-red-500/30 overflow-auto max-h-[200px] whitespace-pre-wrap break-words">
          {oldString || "(empty)"}
        </pre>
      </div>
      <div className="flex-1">
        <span className="text-[0.75rem] font-medium text-green-500 block mb-1">+ Added</span>
        <pre className="m-0 p-2 text-[0.7rem] font-mono bg-green-500/10 rounded border border-green-500/30 overflow-auto max-h-[200px] whitespace-pre-wrap break-words">
          {newString || "(empty)"}
        </pre>
      </div>
    </div>
  );
}
