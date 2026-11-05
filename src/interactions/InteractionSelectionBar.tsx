import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { Columns2, X } from "lucide-react";
import type { useInteraction } from "./runtime";

type Entry = ReturnType<typeof useInteraction>;

/**
 * The error and its retry. The runtime keeps the error until the retry's
 * outcome, so the button stays mounted and keeps focus while it runs (it is
 * aria-disabled, not disabled, which would drop focus). Meanwhile the message
 * says the retry is running; a retry that fails puts the error back, a text
 * change the alert announces again. When a retry succeeds the alert goes; if
 * its button still had focus, focus moves to `focusAfter` instead of falling
 * to the page.
 */
export function InteractionError({
  entry,
  focusAfter,
}: {
  entry: Entry;
  focusAfter: RefObject<HTMLElement | null>;
}) {
  const focused = useRef(false);
  const shown = !!entry.error;
  useLayoutEffect(() => {
    if (shown || !focused.current) return;
    focused.current = false;
    focusAfter.current?.focus();
  }, [shown, focusAfter]);
  if (!entry.error) return null;
  return (
    <div className="interaction-error" role="alert">
      {entry.retrying ? "Trying again…" : entry.error}{" "}
      <button
        type="button"
        aria-disabled={entry.busy || undefined}
        onFocus={() => (focused.current = true)}
        onBlur={() => (focused.current = false)}
        onClick={() => {
          if (!entry.busy) void entry.runtime?.retry(entry.surface.id);
        }}
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
  const { surface, runtime, busy, saving, ready, retry } = entry;
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
  // A failed first load says so once, in the alert above with its action, so
  // the status line and prompt stay empty rather than repeating or
  // contradicting it; while a retry of it runs, they read as a first load.
  const loadFailed = !ready && !!entry.error && !busy;
  const feedback = !runtime
    ? "Preview only"
    : !ready
      ? loadFailed
        ? ""
        : "Loading…"
      : saving
        ? "Saving…"
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
      <InteractionError entry={entry} focusAfter={summary} />
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
              : loadFailed
                ? null
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
