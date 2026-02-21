import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "../../utils/cn";
import { MarkdownContent } from "../MarkdownContent";
import type { CardVisualizationData, CardSection, VisualizationConfig, VisualizationActionEvent } from "../../types";

export interface CardVisualizationProps {
  data: CardVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
  onAction?: (event: VisualizationActionEvent) => void;
}

export function CardVisualization({ data, config, onAction }: CardVisualizationProps) {
  const { subtitle, imageUrl, sections, actions } = data;
  const collapsible = config?.collapsible || false;
  const initiallyCollapsed = config?.initiallyCollapsed || false;
  const [expanded, setExpanded] = useState(!initiallyCollapsed);

  const handleActionClick = (action: string) => {
    if (action.startsWith("http://") || action.startsWith("https://") || action.startsWith("/")) {
      window.open(action, "_blank", "noopener,noreferrer");
    } else if (onAction) {
      onAction({ type: "card_action", action });
    } else {
      window.dispatchEvent(new CustomEvent("visualization-action", { detail: { action } }));
    }
  };

  const renderSection = (section: CardSection, idx: number) => (
    <div key={idx} className={cn(idx < sections.length - 1 && "mb-4")}>
      {section.title && (
        <h4 className="font-semibold text-sm mb-2">{section.title}</h4>
      )}
      {section.items && section.items.length > 0 && (
        <div className="space-y-1">
          {section.items.map((item, itemIdx) => (
            <div key={itemIdx} className="flex justify-between items-start gap-4">
              <span className="text-sm text-gray-500 shrink-0">{item.label}</span>
              <span className="text-sm font-medium text-right">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {section.content && <MarkdownContent>{section.content}</MarkdownContent>}
    </div>
  );

  const mainContent = (
    <>
      {imageUrl && (
        <img src={imageUrl} alt="" className="w-full h-[140px] object-cover border-b border-gray-200 dark:border-gray-700" />
      )}
      {subtitle && (
        <p className="text-sm text-gray-500 italic mb-4">{subtitle}</p>
      )}
      {sections.map((section, idx) => (
        <div key={idx}>
          {renderSection(section, idx)}
          {idx < sections.length - 1 && <hr className="my-4 border-gray-200 dark:border-gray-700" />}
        </div>
      ))}
    </>
  );

  return (
    <div className="w-full">
      {collapsible && (
        <div
          className="flex items-center justify-between mb-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-sm text-gray-500">{expanded ? "Click to collapse" : "Click to expand"}</span>
          <button className="p-1">{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
        </div>
      )}
      {(!collapsible || expanded) && mainContent}
      {actions && actions.length > 0 && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleActionClick(action.action)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg transition-colors",
                action.variant === "primary" ? "bg-blue-500 text-white hover:bg-blue-600" :
                action.variant === "text" ? "text-blue-500 hover:bg-blue-50" :
                "border border-gray-300 hover:bg-gray-50"
              )}
            >
              {action.label}
              {action.action.startsWith("http") && <ExternalLink size={14} className="inline ml-1" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
