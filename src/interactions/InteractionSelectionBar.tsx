import { useEffect, useRef } from "react";
import { Columns2, X } from "lucide-react";
import type { useInteraction } from "./runtime";

type Entry = ReturnType<typeof useInteraction>;

export function InteractionError({ entry }: { entry: Entry }) {
  if (!entry.error) return null;
  return (
    <div className="interaction-error" role="alert">
      {entry.error}{" "}
      <button
        type="button"
        disabled={entry.busy}
        onClick={() => void entry.runtime?.retry(entry.surface.id)}
      >
        {entry.retry ? "Retry saving" : "Refresh result"}
      </button>
    </div>
  );
}

/** The same selection controls appear inline or in the panel's fixed footer. */
export function InteractionSelectionBar({
  entry,
  onCompare,
}: {
  entry: Entry;
  onCompare: () => void;
}) {
  const { surface, runtime, busy, ready, retry } = entry;
  const { selectedIds } = surface.state;
  const selected = surface.data.items.filter((item) =>
    selectedIds.includes(item.id),
  );
  const disabled = !runtime || !ready || busy || !!retry;
  const root = useRef<HTMLElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const removing = useRef<{ index: number; button: HTMLElement } | null>(null);

  useEffect(() => {
    const pending = removing.current;
    if (!pending || busy) return;
    removing.current = null;
    // An acknowledged removal must not strand keyboard focus on the document.
    // If the user moved elsewhere while saving, respect that new focus.
    if (
      document.activeElement !== pending.button &&
      document.activeElement !== document.body
    )
      return;
    const buttons = root.current?.querySelectorAll<HTMLButtonElement>(
      "[data-remove-selection]",
    );
    const next = buttons?.[Math.min(pending.index, buttons.length - 1)];
    (next ?? summary.current)?.focus({ preventScroll: true });
  }, [busy, selectedIds]);

  const limit = surface.selectionLimit;
  const allowsComparison = limit >= 2;
  const requirement = allowsComparison
    ? limit === 2
      ? "Choose 2 products to compare"
      : `Choose 2–${limit} products to compare`
    : `Choose up to ${limit} product${limit === 1 ? "" : "s"}`;
  const feedback = busy
    ? "Saving…"
    : !runtime
      ? "Preview only"
      : !ready
        ? "Connecting…"
        : retry || entry.error
          ? "Changes need attention"
          : selected.length === 1 && allowsComparison
            ? "Selection saved. Select 1 more to compare."
            : selected.length
              ? "Saved to this conversation"
              : "Select products to compare side by side.";

  return (
    <section
      className="interaction-selection"
      aria-label="Product selection"
      ref={root}
    >
      <InteractionError entry={entry} />
      {selected.length > 0 && (
        <div
          className="interaction-selection-chips"
          aria-label="Selected products"
        >
          {selected.map((item, index) => (
            <button
              key={item.id}
              data-remove-selection
              type="button"
              disabled={disabled}
              aria-label={`Remove ${item.title} from selection`}
              onClick={(event) => {
                removing.current = { index, button: event.currentTarget };
                void runtime?.act(surface.id, "select", {
                  ids: selectedIds.filter((id) => id !== item.id),
                });
              }}
            >
              <span>{item.title}</span>
              <X size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <div className="interaction-selection-actions">
        <div
          className="interaction-selection-status"
          ref={summary}
          tabIndex={-1}
          role="status"
          aria-live="polite"
        >
          <strong>
            {selected.length
              ? `${selected.length} of ${limit} selected`
              : requirement}
          </strong>
          <span>{feedback}</span>
        </div>
        {allowsComparison && (
          <button
            type="button"
            className={selected.length >= 2 ? "interaction-primary" : undefined}
            disabled={disabled || selected.length < 2}
            onClick={onCompare}
          >
            <Columns2 size={16} aria-hidden="true" />
            {selected.length === 1
              ? "Select 1 more"
              : selected.length >= 2
                ? `Compare ${selected.length} products`
                : "Compare products"}
          </button>
        )}
      </div>
    </section>
  );
}
