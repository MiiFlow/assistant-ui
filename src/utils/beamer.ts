import type { CSSProperties } from "react";

const BEAMER_STYLE_ID = "miiflow-beamer-keyframes";

/**
 * Injects @keyframes beamer into the appropriate root.
 * When an element inside a Shadow DOM is provided, injects into the shadow root
 * so the animation works in Shadow DOM contexts (e.g. embedded widget).
 * Otherwise falls back to document.head.
 */
export function injectBeamerKeyframes(el?: HTMLElement | null): void {
  if (typeof document === "undefined") return;

  const root = el?.getRootNode?.();
  const container = root instanceof ShadowRoot ? root : document.head;

  if (container.querySelector(`#${BEAMER_STYLE_ID}`)) return;

  const style = document.createElement("style");
  style.id = BEAMER_STYLE_ID;
  style.textContent = `@keyframes beamer{0%{left:-30%}100%{left:100%}}`;
  container.appendChild(style);
}

/**
 * Inline style for the beamer bar overlay element.
 * Matches the on-platform MUI sx approach exactly.
 */
export const beamerBarStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: "-30%",
  width: "30%",
  height: "100%",
  background:
    "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.7) 50%, transparent 100%)",
  animation: "beamer 2s linear infinite",
  zIndex: 1,
  pointerEvents: "none",
};
