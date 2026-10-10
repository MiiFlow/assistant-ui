import { createContext, useContext, type ReactNode } from "react";
import type { StreamingChunk } from "../../types";

/** Host-owned work can outlive the model turn that submitted it. */
export interface ToolActivity {
	status: "queued" | "running" | "waiting" | "done" | "failed" | "interrupted";
	label: string;
	title?: string;
	details?: ReactNode;
}
export type ToolActivityResolver = (chunk: StreamingChunk) => ToolActivity | undefined;
const ToolActivityContext = createContext<ToolActivityResolver>(() => undefined);
export const ToolActivityProvider = ToolActivityContext.Provider;
export const useToolActivity = () => useContext(ToolActivityContext);
