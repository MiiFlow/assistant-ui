import type { ReactNode } from "react";
import { Expand } from "lucide-react";

/** Shared identity and navigation for a result, a question or an editable draft. */
export function WorkItemHeader({
  title,
  label,
  summary,
  expanded = false,
  onOpen,
  actionLabel,
  titleId,
  headingLevel: Heading = "h3",
  status,
}: {
  title: string;
  label: string;
  summary?: ReactNode;
  expanded?: boolean;
  onOpen?: () => void;
  actionLabel?: string;
  titleId?: string;
  headingLevel?: "h3" | "h5";
  status?: ReactNode;
}) {
  return (
    <header className="interaction-heading work-item-heading">
      <div className="work-item-identity">
        <span className="interaction-eyebrow">{label}</span>
        <Heading id={titleId}>{title}</Heading>
        {summary && <p className="interaction-reference-summary">{summary}</p>}
      </div>
      {status}
      {onOpen && (
        <button
          className={
            expanded || actionLabel ? "work-item-open" : "interaction-icon"
          }
          type="button"
          aria-label={
            actionLabel ||
            (expanded ? `Focus ${title}` : `Expand ${title}`)
          }
          onClick={onOpen}
        >
          <Expand size={17} aria-hidden="true" />
          {(expanded || actionLabel) && <span>{actionLabel || "View"}</span>}
        </button>
      )}
    </header>
  );
}
