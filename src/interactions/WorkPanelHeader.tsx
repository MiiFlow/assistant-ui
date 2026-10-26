import type { ReactNode } from "react";
import { FileText } from "lucide-react";

/** One compact workspace identity across side, inline and full-screen frames. */
export function WorkPanelHeader({
  title,
  label,
  icon,
  children,
}: {
  title: string;
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="interaction-panel-header">
      <div className="interaction-panel-identity">
        <span className="interaction-panel-resource-icon" title={label} aria-hidden="true">
          {icon ?? <FileText size={16} />}
        </span>
        <h2 title={title} aria-label={`${label}: ${title}`}>{title}</h2>
      </div>
      <div className="interaction-inline-panel-actions">{children}</div>
    </header>
  );
}
