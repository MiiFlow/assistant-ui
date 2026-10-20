import { createContext, useContext, type ReactNode } from "react";
import type { StreamingChunk } from "../../types";

/** Host-owned work can outlive the model turn that submitted it. */
export interface ToolActivity {
	status: "queued" | "running" | "waiting" | "done" | "failed" | "interrupted";
	/** Whether work is currently progressing; parked/needs-attention states are false. */
	active?: boolean;
	label: string;
	title?: string;
	details?: ReactNode;
	/** Show live host-owned work until the reader explicitly folds it. */
	defaultExpanded?: boolean;
}
export type ToolActivityResolver = (chunk: StreamingChunk) => ToolActivity | undefined;
const ToolActivityContext = createContext<ToolActivityResolver>(() => undefined);
export const ToolActivityProvider = ToolActivityContext.Provider;
export const useToolActivity = () => useContext(ToolActivityContext);

/** Shared lifecycle contract for headers and completion-only message chrome. */
export function isToolActivityActive(activity: ToolActivity | undefined): boolean {
	return !!activity && (activity.active ?? (activity.status === "queued" || activity.status === "running"));
}
