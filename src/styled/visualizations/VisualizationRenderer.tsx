import { AlertCircle } from "lucide-react";
import type { VisualizationActionEvent, VisualizationChunkData } from "../../types";
import { getVisualization } from "./registry";
// Side-effect import: ensures schemas are registered alongside components
import "./schemas";

export interface VisualizationRendererProps {
  data: VisualizationChunkData;
  isStreaming?: boolean;
  onAction?: (event: VisualizationActionEvent) => void;
}

export function VisualizationRenderer({
  data,
  isStreaming = false,
  onAction,
}: VisualizationRendererProps) {
  const { type, title, description, data: vizData, config } = data;

  const renderVisualization = () => {
    const entry = getVisualization(type);

    if (!entry) {
      return (
        <div className="flex items-center gap-2 p-4 text-yellow-500">
          <AlertCircle size={20} />
          <span className="text-sm">Unknown visualization type: {type}</span>
        </div>
      );
    }

    // Schema validation (if a schema is registered for this type)
    if (entry.schema) {
      const result = entry.schema.safeParse(vizData);
      if (!result.success) {
        const issues = result.error.issues.slice(0, 3);
        return (
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">
                Invalid {type} visualization data
              </span>
            </div>
            <ul className="text-xs text-red-500 dark:text-red-400 space-y-1 list-disc list-inside">
              {issues.map((issue, i) => (
                <li key={i}>
                  {issue.path.join(".")}: {issue.message}
                </li>
              ))}
              {result.error.issues.length > 3 && (
                <li>...and {result.error.issues.length - 3} more</li>
              )}
            </ul>
          </div>
        );
      }
    }

    const Component = entry.component;
    return (
      <Component
        data={vizData}
        config={config}
        isStreaming={isStreaming}
        onAction={onAction}
      />
    );
  };

  return (
    <div className="my-3 overflow-hidden">
      {(title || description) && (
        <div className="mb-2">
          {title && <p className="text-sm font-semibold">{title}</p>}
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div>{renderVisualization()}</div>
    </div>
  );
}
