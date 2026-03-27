import { useState, useCallback } from "react";
import { Shield, Check, X } from "lucide-react";
import { cn } from "../utils/cn";
import type { ToolApprovalData } from "../types";

export interface ToolApprovalPanelProps {
  approval: ToolApprovalData;
  onApprove: (modifiedInputs: Record<string, unknown>) => void;
  onReject: (reason?: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Tool approval panel - displays when the AI agent needs user approval before
 * executing a tool. Shows tool summary, editable parameters, and approve/reject actions.
 * Amber left-border panel (distinguished from orange clarification panel).
 */
export function ToolApprovalPanel({
  approval,
  onApprove,
  onReject,
  disabled = false,
  className,
}: ToolApprovalPanelProps) {
  const [editedInputs, setEditedInputs] = useState<Record<string, unknown>>(
    () => ({ ...approval.toolInputs })
  );
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = useCallback(() => {
    onApprove(editedInputs);
  }, [onApprove, editedInputs]);

  const handleReject = useCallback(() => {
    if (showRejectReason) {
      onReject(rejectReason || undefined);
    } else {
      setShowRejectReason(true);
    }
  }, [onReject, showRejectReason, rejectReason]);

  const handleInputChange = useCallback(
    (key: string, value: unknown) => {
      setEditedInputs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Get parameter properties from tool schema for form rendering
  const schemaProperties =
    (approval.toolSchema?.parameters as Record<string, unknown>)?.properties as
      | Record<string, Record<string, unknown>>
      | undefined;

  // Filter out internal __description param from displayed inputs
  const displayInputs = Object.entries(editedInputs).filter(
    ([key]) => key !== "__description"
  );

  return (
    <div
      className={cn(
        "mx-4 mb-3 px-4 py-3",
        "bg-amber-50/60 dark:bg-amber-950/20",
        "border-l-[3px] border-amber-500",
        "rounded-r-lg",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-amber-600 mt-0.5">
          <Shield size={14} />
        </span>
        <p className="text-sm font-medium flex-1 min-w-0">
          Approval required:{" "}
          {approval.toolDescription || approval.toolName}
        </p>
      </div>

      {/* Editable parameters form */}
      {displayInputs.length > 0 && (
        <div className="ml-5 mb-3 space-y-2">
          {displayInputs.map(([key, value]) => {
            const paramSchema = schemaProperties?.[key];
            const paramType = (paramSchema?.type as string) || "string";
            const paramDesc = paramSchema?.description as string | undefined;
            const paramEnum = paramSchema?.enum as string[] | undefined;

            return (
              <div key={key} className="flex flex-col gap-0.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {key}
                  {paramDesc && (
                    <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">
                      - {paramDesc}
                    </span>
                  )}
                </label>
                {paramEnum && paramEnum.length > 0 ? (
                  <select
                    value={String(value ?? "")}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    disabled={disabled}
                    className="text-sm bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 disabled:opacity-50"
                  >
                    {paramEnum.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : paramType === "boolean" ? (
                  <select
                    value={String(Boolean(value))}
                    onChange={(e) => handleInputChange(key, e.target.value === "true")}
                    disabled={disabled}
                    className="text-sm bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 disabled:opacity-50"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : typeof value === "object" && value !== null ? (
                  <textarea
                    value={JSON.stringify(value, null, 2)}
                    onChange={(e) => {
                      try {
                        handleInputChange(key, JSON.parse(e.target.value));
                      } catch {
                        // Keep raw string if not valid JSON
                      }
                    }}
                    disabled={disabled}
                    rows={3}
                    className="text-xs font-mono bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5 resize-y disabled:opacity-50"
                  />
                ) : (
                  <input
                    type={paramType === "number" || paramType === "integer" ? "number" : "text"}
                    value={String(value ?? "")}
                    onChange={(e) => {
                      const newVal =
                        paramType === "number" || paramType === "integer"
                          ? Number(e.target.value)
                          : e.target.value;
                      handleInputChange(key, newVal);
                    }}
                    disabled={disabled}
                    className="text-sm bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 disabled:opacity-50"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject reason input */}
      {showRejectReason && (
        <div className="ml-5 mb-3">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onReject(rejectReason || undefined);
              }
            }}
            placeholder="Reason for rejection (optional)..."
            disabled={disabled}
            autoFocus
            className="w-full text-sm bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded px-2 py-1 disabled:opacity-50 placeholder:text-gray-400"
          />
        </div>
      )}

      {/* Action buttons — both use same padding/height for consistent layout */}
      <div className="flex items-center gap-2 ml-5">
        <button
          onClick={handleApprove}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors",
            "bg-green-600 hover:bg-green-700 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Check size={14} />
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors",
            "bg-gray-200 text-gray-700 hover:bg-red-600 hover:text-white",
            "dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-600 dark:hover:text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <X size={14} />
          {showRejectReason ? "Confirm Reject" : "Reject"}
        </button>
      </div>
    </div>
  );
}
