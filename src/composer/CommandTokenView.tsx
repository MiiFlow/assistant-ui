import type { CSSProperties, ReactNode } from "react";

/**
 * Single source of truth for slash-command token visuals.
 *
 * Used in three places:
 *  - Typeahead popover row (variant="row")
 *  - Inline chip in the editor (variant="chip", inside CommandTokenNode.decorate)
 *  - Inline chip in message history (variant="chip", inside MarkdownContent)
 *
 * Renders a kind tag + label so the user gets the same visual identity at
 * every step: pick → type → send → re-read. Adapts to the surrounding text
 * color via `currentColor` so it survives light bubbles, dark bubbles, and
 * any branded chat surface without bespoke palettes.
 */
export interface CommandTokenViewProps {
  /** Slug-style id (wire format `/<id>:<kind>`). */
  id: string;
  /** Token category, e.g. "skill", "mode". Rendered as the leading tag. */
  kind: string;
  /** Display name; falls back to `id` if not provided. */
  label?: string;
  /** Optional secondary line; only rendered for variant="row". */
  description?: string;
  /** Optional leading icon (slotted before the label, after the tag). */
  icon?: ReactNode;
  /** Optional override for the leading tag (where `kind` renders by default).
   * When set, replaces the uppercase kind pill — e.g. swap "AD-ACCOUNT" for
   * the platform logo. */
  tag?: ReactNode;
  /** Compact inline pill ("chip") vs. full popover row ("row"). */
  variant?: "chip" | "row";
  /** When true, applies the row's "selected" styling. */
  selected?: boolean;
  /** Optional click handler (popover row uses it; chip doesn't by default). */
  onMouseEnter?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  /** Pass-through id for ARIA wiring (used by typeahead). */
  htmlId?: string;
}

const TAG_BG = "color-mix(in srgb, currentColor 16%, transparent)";
const CHIP_BG = "color-mix(in srgb, currentColor 8%, transparent)";
const ROW_HOVER_BG = "color-mix(in srgb, currentColor 6%, transparent)";
const ROW_SELECTED_BG = "color-mix(in srgb, currentColor 12%, transparent)";

const tagStyle: CSSProperties = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  padding: "2px 5px",
  borderRadius: 3,
  background: TAG_BG,
  lineHeight: 1,
};

export function CommandTokenView({
  id,
  kind,
  label,
  description,
  icon,
  tag,
  variant = "chip",
  selected = false,
  onMouseEnter,
  onMouseDown,
  htmlId,
}: CommandTokenViewProps) {
  const display = label ?? id;

  // When the caller supplies a tag node (e.g. a platform logo for an
  // ad-account chip), render it raw — no uppercase pill background. The
  // default kind text still uses tagStyle.
  const tagNode =
    tag !== undefined ? (
      <span style={{ display: "inline-flex", flexShrink: 0, alignItems: "center" }}>{tag}</span>
    ) : (
      <span style={tagStyle}>{kind}</span>
    );

  if (variant === "chip") {
    return (
      <span
        data-chat-command-chip="true"
        data-command-id={id}
        data-command-kind={kind}
        title={`${kind}: ${id}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          verticalAlign: "middle",
          background: CHIP_BG,
          borderRadius: 999,
          padding: "2px 9px 2px 4px",
          margin: "0 1px",
          whiteSpace: "nowrap",
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        {tagNode}
        {icon && (
          <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
        )}
        <span>{display}</span>
      </span>
    );
  }

  // variant === "row"
  return (
    <div
      role="option"
      aria-selected={selected}
      id={htmlId}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      data-command-id={id}
      data-command-kind={kind}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 6,
        cursor: "pointer",
        background: selected ? ROW_SELECTED_BG : "transparent",
        transition: "background 80ms ease",
      }}
      onMouseOver={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.background = ROW_HOVER_BG;
        }
      }}
      onMouseOut={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }
      }}
    >
      <span style={tagStyle}>{kind}</span>
      {icon && (
        <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      )}
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {display}
        </div>
        {description && (
          <div
            style={{
              fontSize: 11,
              opacity: 0.65,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
