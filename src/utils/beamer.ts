import type { CSSProperties } from "react";

const KEYFRAME_STYLE_ID = "miiflow-reasoning-keyframes";

const KEYFRAME_CONTENT = `
@keyframes beamer{0%{left:-30%}100%{left:100%}}
@keyframes mf-halo{0%,100%{opacity:0;transform:translate(-50%,-50%) scale(.65)}50%{opacity:.5;transform:translate(-50%,-50%) scale(1)}}
@keyframes mf-wave{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-1.5px)}}
@keyframes mf-caret{0%,100%{opacity:.95}50%{opacity:.15}}
@keyframes mf-rail-flow{0%{transform:translateY(-110%)}100%{transform:translateY(220%)}}
@keyframes mf-text-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
@keyframes mf-bars{0%,100%{transform:scaleY(.28)}50%{transform:scaleY(1)}}
@keyframes mf-led{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes mf-scanline{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}
@keyframes mf-mono-blink{0%,49%{opacity:1}50%,100%{opacity:.45}}
@keyframes mf-row-enter{0%{opacity:0;transform:translateY(3px)}100%{opacity:1;transform:translateY(0)}}
@keyframes mf-halo-once{0%{opacity:0;transform:scale(.4)}38%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.55)}}
@keyframes mf-chip-in{0%{opacity:0;transform:translateY(2px) scale(.97)}100%{opacity:1;transform:none}}
@keyframes mf-figure-in{0%{opacity:0;transform:translateX(-2px)}100%{opacity:1;transform:none}}
@keyframes mf-commit{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--chat-text) 34%,transparent);opacity:1}100%{box-shadow:0 0 0 7px color-mix(in srgb,var(--chat-text) 0%,transparent);opacity:0}}
@keyframes mf-step-in{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}
@keyframes mf-agent-in{0%{opacity:0;transform:scale(.82)}100%{opacity:1;transform:none}}
@keyframes mf-ring-travel{to{stroke-dashoffset:-71}}
@keyframes mf-halo-breathe{0%,100%{opacity:.35;transform:scale(.86)}50%{opacity:.85;transform:scale(1.06)}}
@keyframes mf-mark-breathe{0%,100%{transform:scale(.94)}50%{transform:scale(1.04)}}
@keyframes mf-panel-in-right{0%{opacity:0;transform:translateX(6px)}100%{opacity:1;transform:none}}
@keyframes mf-panel-in-left{0%{opacity:0;transform:translateX(-6px)}100%{opacity:1;transform:none}}
@keyframes mf-card-in{0%{opacity:0;transform:translateY(-3px)}100%{opacity:1;transform:translateY(0)}}
.mf-row-enter{animation:mf-row-enter 360ms cubic-bezier(.16,1,.3,1) both}
.mf-tool-mark{transition:transform 220ms cubic-bezier(.16,1,.3,1);transform-origin:50% 62%;will-change:transform}
.mf-tool-row:hover .mf-tool-mark{transform:rotate(-9deg) scale(1.08)}
.mf-focus{outline:none}
.mf-focus:focus-visible{outline:2px solid color-mix(in srgb,var(--chat-text) 45%,transparent);outline-offset:2px;border-radius:6px}
@media (prefers-reduced-motion:reduce){.mf-row-enter{animation:none}.mf-chip{animation:none!important}.mf-step{animation:none!important}.mf-pip-ring{animation:none!important}.mf-tool-mark{transition:none}.mf-tool-row:hover .mf-tool-mark{transform:none}}
`;

/**
 * Injects keyframes used by the reasoning panel into the appropriate root.
 * When called inside a Shadow DOM, injects into the shadow root so the
 * animations resolve in that scope (embedded widget). Otherwise falls back
 * to document.head.
 *
 * Re-runs every mount: if a style tag with our id already exists but its
 * content is stale (e.g. a previous build wrote an older set of keyframes
 * and the tag survived across navigations), update its text in place
 * rather than returning early. This avoids the "new keyframe missing
 * until full refresh" pitfall during development and live deploys.
 */
export function injectBeamerKeyframes(el?: HTMLElement | null): void {
  if (typeof document === "undefined") return;

  const root = el?.getRootNode?.();
  const container = root instanceof ShadowRoot ? root : document.head;

  const existing = (container as Document | ShadowRoot).querySelector(
    `#${KEYFRAME_STYLE_ID}`,
  );
  if (existing) {
    if (existing.textContent !== KEYFRAME_CONTENT) {
      existing.textContent = KEYFRAME_CONTENT;
    }
    return;
  }

  const style = document.createElement("style");
  style.id = KEYFRAME_STYLE_ID;
  style.textContent = KEYFRAME_CONTENT;
  container.appendChild(style);
}

/**
 * Inline style for the row-level beamer overlay.
 *
 * Originally rendered as a pure white 70% sweep, which required a tinted
 * background underneath for visibility. The new design has no row tint,
 * so the shimmer uses an ink-tinted color-mix that adapts to the theme:
 * a soft dark sweep on light backgrounds, a soft light sweep on dark.
 * Drives the running-state motion on Timeline rows.
 */
export const beamerBarStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: "-30%",
  width: "30%",
  height: "100%",
  background:
    "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--chat-text) 11%, transparent) 50%, transparent 100%)",
  animation: "beamer 2s linear infinite",
  zIndex: 1,
  pointerEvents: "none",
};
