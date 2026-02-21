import type { VisualizationConfig } from "../../types";
import type { ZodSchema } from "zod";

export interface VisualizationEntry {
  component: React.ComponentType<{
    data: any;
    config?: VisualizationConfig;
    isStreaming?: boolean;
    onAction?: (event: import("../../types").VisualizationActionEvent) => void;
  }>;
  schema?: ZodSchema;
}

const registry = new Map<string, VisualizationEntry>();

/**
 * Register a visualization type. Built-in types are registered at module load.
 * Consumers can call this to add custom visualization types.
 */
export function registerVisualization(
  type: string,
  entry: VisualizationEntry,
): void {
  registry.set(type, entry);
}

/**
 * Look up a registered visualization by type string.
 */
export function getVisualization(type: string): VisualizationEntry | undefined {
  return registry.get(type);
}

/**
 * Return all registered visualization type strings.
 */
export function getRegisteredTypes(): string[] {
  return Array.from(registry.keys());
}

// ---------------------------------------------------------------------------
// Register built-in visualization types
// ---------------------------------------------------------------------------

import { ChartVisualization } from "./ChartVisualization";
import { TableVisualization } from "./TableVisualization";
import { CardVisualization } from "./CardVisualization";
import { KpiVisualization } from "./KpiVisualization";
import { CodePreviewVisualization } from "./CodePreviewVisualization";
import { FormVisualization } from "./FormVisualization";

// Schemas are registered lazily after the schemas module is loaded to avoid
// circular-dependency issues.  The `registerBuiltinSchemas` helper is called
// from schemas.ts at module-load time.
registerVisualization("chart", { component: ChartVisualization });
registerVisualization("table", { component: TableVisualization });
registerVisualization("card", { component: CardVisualization });
registerVisualization("kpi", { component: KpiVisualization });
registerVisualization("code_preview", { component: CodePreviewVisualization });
registerVisualization("form", { component: FormVisualization });

/**
 * Attach schemas to already-registered built-in types.
 * Called from schemas.ts at module-load time.
 */
export function registerBuiltinSchemas(
  schemas: Record<string, ZodSchema>,
): void {
  for (const [type, schema] of Object.entries(schemas)) {
    const entry = registry.get(type);
    if (entry) {
      entry.schema = schema;
    }
  }
}
