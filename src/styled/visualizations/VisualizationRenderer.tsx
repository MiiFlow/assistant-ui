import { AlertCircle } from "lucide-react";
import type { VisualizationChunkData, VisualizationType } from "../../types";
import { ChartVisualization } from "./ChartVisualization";
import { TableVisualization } from "./TableVisualization";
import { CardVisualization } from "./CardVisualization";
import { KpiVisualization } from "./KpiVisualization";
import { CodePreviewVisualization } from "./CodePreviewVisualization";
import { FormVisualization } from "./FormVisualization";

export interface VisualizationRendererProps {
  data: VisualizationChunkData;
  isStreaming?: boolean;
}

export function VisualizationRenderer({ data, isStreaming = false }: VisualizationRendererProps) {
  const { type, title, description, data: vizData, config } = data;

  const renderVisualization = () => {
    switch (type as VisualizationType) {
      case "chart":
        return <ChartVisualization data={vizData as any} config={config} isStreaming={isStreaming} />;
      case "table":
        return <TableVisualization data={vizData as any} config={config} isStreaming={isStreaming} />;
      case "card":
        return <CardVisualization data={vizData as any} config={config} isStreaming={isStreaming} />;
      case "kpi":
        return <KpiVisualization data={vizData as any} config={config} isStreaming={isStreaming} />;
      case "code_preview":
        return <CodePreviewVisualization data={vizData as any} config={config} isStreaming={isStreaming} />;
      case "form":
        return <FormVisualization data={vizData as any} config={config} isStreaming={isStreaming} />;
      default:
        return (
          <div className="flex items-center gap-2 p-4 text-yellow-500">
            <AlertCircle size={20} />
            <span className="text-sm">Unknown visualization type: {type}</span>
          </div>
        );
    }
  };

  return (
    <div className="my-3 overflow-hidden">
      {(title || description) && (
        <div className="mb-2">
          {title && <p className="text-sm font-semibold">{title}</p>}
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      )}
      <div>{renderVisualization()}</div>
    </div>
  );
}
