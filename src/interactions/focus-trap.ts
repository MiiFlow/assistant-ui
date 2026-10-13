import type { KeyboardEvent } from "react";

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), iframe, [tabindex="0"]';

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) =>
      element.getClientRects().length > 0 && !element.closest("[inert]"),
  );
}

/**
 * Keeps Tab inside `root`; used by overlay frames whose backdrop blocks the
 * conversation behind them.
 */
export function trapTabKey(
  root: HTMLElement,
  event: KeyboardEvent<HTMLElement>,
): void {
  if (event.key !== "Tab") return;
  const focusable = getFocusableElements(root);
  const first = focusable[0],
    last = focusable[focusable.length - 1];
  const active = document.activeElement;
  // Removal can focus a status with tabindex=-1. Include that position when
  // deciding whether Tab would cross the frame's boundary.
  const direction = event.shiftKey
    ? Node.DOCUMENT_POSITION_PRECEDING
    : Node.DOCUMENT_POSITION_FOLLOWING;
  if (
    active &&
    !focusable.some((element) =>
      Boolean(active.compareDocumentPosition(element) & direction),
    )
  ) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
}
