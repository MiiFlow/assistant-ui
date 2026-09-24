/**
 * The activity transcript's stylesheet, injected with the panel keyframes (so
 * it also reaches a Shadow DOM host). Classes are `mf-tx-*`, and row kinds are
 * `mf-tx-k-*`, so a content class can never restyle a row's grid.
 *
 * Colour rules:
 * - Every connector (rail, elbows, trunks, hairlines) and every node fill that
 *   sits on one uses an OPAQUE colour — text mixed into the surface, never
 *   into transparent. Translucent lines darken wherever two of them meet.
 * - The activity accent marks what is live. It is the only saturated colour
 *   while a run works, and it leaves the transcript when the run ends.
 */
export const TRANSCRIPT_CSS = `
.mf-tx{
--mf-tx-accent:var(--chat-activity,var(--chat-primary));
--mf-tx-accent-ink:color-mix(in srgb,var(--mf-tx-accent) 72%,var(--chat-text));
--mf-tx-surface:var(--chat-surface,#ffffff);
--mf-tx-rule:var(--chat-rule,color-mix(in srgb,var(--chat-text) 18%,var(--mf-tx-surface)));
--mf-tx-rule-soft:color-mix(in srgb,var(--chat-text) 10%,var(--mf-tx-surface));
--mf-tx-node:color-mix(in srgb,var(--chat-text) 42%,var(--mf-tx-surface));
--mf-tx-node-done:color-mix(in srgb,var(--chat-text) 55%,var(--mf-tx-surface));
--mf-tx-dot:color-mix(in srgb,var(--chat-text) 30%,var(--mf-tx-surface));
--mf-tx-muted:color-mix(in srgb,var(--chat-text) 58%,transparent);
--mf-tx-mono:var(--chat-font-mono,ui-monospace,monospace);
display:flex;flex-direction:column;gap:10px;min-width:0}
.mf-tx-mono{font-family:var(--mf-tx-mono);font-variant-numeric:tabular-nums;font-variant-ligatures:none}
.mf-tx-caps{font-family:var(--mf-tx-mono);font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--mf-tx-muted)}
.mf-tx-enter{animation:mf-tx-in 340ms cubic-bezier(.16,1,.3,1) both}
@keyframes mf-tx-in{from{opacity:0;transform:translateY(5px)}}

.mf-tx-hud{position:relative;align-self:flex-start;max-width:100%;display:inline-flex;align-items:center;flex-wrap:wrap;gap:4px 10px;padding:6px 12px 9px 0;border:0;border-radius:2px;background:transparent;color:var(--chat-text);font:inherit;text-align:left;cursor:default}
.mf-tx-hud[data-foldable]{cursor:pointer}
.mf-tx-hud::after{content:"";position:absolute;inset:-2px -4px -2px -6px;pointer-events:none;opacity:0;transition:opacity 160ms cubic-bezier(.16,1,.3,1);
--b:var(--mf-tx-node);
background:linear-gradient(var(--b),var(--b)) left top/7px 1px no-repeat,linear-gradient(var(--b),var(--b)) left top/1px 7px no-repeat,linear-gradient(var(--b),var(--b)) right top/7px 1px no-repeat,linear-gradient(var(--b),var(--b)) right top/1px 7px no-repeat,linear-gradient(var(--b),var(--b)) left bottom/7px 1px no-repeat,linear-gradient(var(--b),var(--b)) left bottom/1px 7px no-repeat,linear-gradient(var(--b),var(--b)) right bottom/7px 1px no-repeat,linear-gradient(var(--b),var(--b)) right bottom/1px 7px no-repeat}
.mf-tx-hud[data-foldable]:hover::after,.mf-tx-hud:focus-visible::after{opacity:1}
.mf-tx-hud:focus-visible{outline:none}
.mf-tx-hud-mark{width:22px;display:inline-flex;justify-content:center;flex-shrink:0}
.mf-tx-hud-main{display:inline-flex;align-items:baseline;gap:10px}
.mf-tx-hud-state{font-family:var(--mf-tx-mono);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.mf-tx-hud[data-status="running"] .mf-tx-hud-state{color:var(--mf-tx-accent-ink)}
.mf-tx-hud[data-status="waiting"] .mf-tx-hud-state{color:color-mix(in srgb,var(--chat-warning) 70%,var(--chat-text))}
.mf-tx-hud[data-status="failed"] .mf-tx-hud-state{color:var(--chat-error)}
.mf-tx-hud[data-status="completed"] .mf-tx-hud-state{font-family:inherit;font-size:14px;font-weight:600;letter-spacing:0;text-transform:none}
.mf-tx-hud-time{font-family:var(--mf-tx-mono);font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--mf-tx-muted)}
.mf-tx-hud-stats{display:inline-flex;flex-wrap:wrap;gap:4px 12px;font-family:var(--mf-tx-mono);font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--mf-tx-muted)}
.mf-tx-hud-chev{display:inline-flex;color:var(--mf-tx-muted);transition:transform 200ms cubic-bezier(.16,1,.3,1)}
.mf-tx-hud[aria-expanded="true"] .mf-tx-hud-chev{transform:rotate(90deg)}
.mf-tx-swap{animation:mf-tx-swap 200ms cubic-bezier(.16,1,.3,1)}
@keyframes mf-tx-swap{from{opacity:0;transform:translateY(2px)}}
.mf-tx-hud-line{position:absolute;left:22px;right:0;bottom:0;height:1px;overflow:hidden;background:var(--mf-tx-rule-soft)}
.mf-tx-hud-beam{position:absolute;top:0;left:-34%;width:34%;height:1px;opacity:0;background:linear-gradient(90deg,transparent,var(--mf-tx-accent),transparent)}
.mf-tx-hud[data-status="running"] .mf-tx-hud-beam{opacity:1;animation:mf-tx-beam 1.6s linear infinite}
@keyframes mf-tx-beam{to{left:100%}}

.mf-tx-mark-arc{animation:mf-tx-arc 1.4s linear infinite}
@keyframes mf-tx-arc{to{stroke-dashoffset:-100}}
.mf-tx-mark-tick{stroke-dashoffset:0}
.mf-tx-mark[data-live] .mf-tx-mark-tick{animation:mf-tx-draw 420ms cubic-bezier(.16,1,.3,1) both}
@keyframes mf-tx-draw{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
.mf-tx-mark[data-state="waiting"]{animation:mf-tx-breathe 2.4s ease-in-out infinite}
@keyframes mf-tx-breathe{50%{opacity:.45}}

.mf-tx-rail{display:flex;flex-direction:column;gap:14px;padding-top:4px}
.mf-tx-rail[hidden]{display:none}
.mf-tx-row{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr);min-width:0}
.mf-tx-row::before{content:"";position:absolute;left:10.5px;top:-14px;bottom:0;width:1px;background:var(--mf-tx-rule)}
.mf-tx-row:last-child::before{bottom:auto;height:25px}
.mf-tx-node{position:relative;z-index:1;justify-self:center;margin-top:9px;width:7px;height:7px;border-radius:2px;background:var(--mf-tx-surface);box-shadow:inset 0 0 0 1.5px var(--mf-tx-node)}
.mf-tx-k-text .mf-tx-node,.mf-tx-k-reasoning .mf-tx-node{width:5px;height:5px;margin-top:11px;border-radius:50%;box-shadow:none;background:var(--mf-tx-dot)}
.mf-tx-row[data-state="done"] .mf-tx-node{background:var(--mf-tx-node-done);box-shadow:none}
.mf-tx-row[data-state="failed"] .mf-tx-node{background:var(--mf-tx-surface);box-shadow:inset 0 0 0 1.5px var(--chat-error)}
.mf-tx-row[data-state="live"] .mf-tx-node{background:var(--mf-tx-accent);box-shadow:none}
.mf-tx-row[data-state="live"] .mf-tx-node::after{content:"";position:absolute;inset:-5px;border:1px solid var(--mf-tx-accent);border-radius:4px;animation:mf-tx-halo 1.8s cubic-bezier(.16,1,.3,1) infinite}
.mf-tx-k-text[data-state="live"] .mf-tx-node::after{border-radius:50%}
@keyframes mf-tx-halo{0%{opacity:.7;transform:scale(.6)}100%{opacity:0;transform:scale(1.25)}}
.mf-tx-pulse{position:absolute;left:10px;top:-14px;width:2px;height:24px;overflow:hidden;z-index:0}
.mf-tx-pulse::after{content:"";position:absolute;left:0;top:-10px;width:2px;height:10px;border-radius:1px;background:linear-gradient(transparent,var(--mf-tx-accent));animation:mf-tx-down 1.1s cubic-bezier(.16,1,.3,1) infinite}
@keyframes mf-tx-down{to{top:24px}}
.mf-tx-body{min-width:0}

.mf-tx-reasoning>summary{display:inline-flex;align-items:center;gap:6px;padding:5px 0;cursor:pointer;list-style:none}
.mf-tx-reasoning>summary::-webkit-details-marker{display:none}
.mf-tx-reasoning-body{font-size:14px;line-height:1.6;color:var(--mf-tx-muted)}

.mf-tx-grp-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:3px 0 6px}
.mf-tx-grp-title{font-size:14px;font-weight:600;color:var(--chat-text)}
.mf-tx-grp-live{font-family:var(--mf-tx-mono);font-size:11.5px;color:var(--mf-tx-accent-ink)}
.mf-tx-lanes{position:relative;display:flex;flex-direction:column;min-width:0}
.mf-tx-lanes[data-fork]{padding-left:18px}
.mf-tx-lane{position:relative;min-width:0}
.mf-tx-lanes[data-fork]>.mf-tx-lane::before{content:"";position:absolute;left:-14px;top:0;width:11px;height:15px;border-left:1px solid var(--mf-tx-branch);border-bottom:1px solid var(--mf-tx-branch);border-bottom-left-radius:6px;--mf-tx-branch:var(--mf-tx-rule)}
.mf-tx-lanes[data-fork]>.mf-tx-lane:not(:last-child)::after,.mf-tx-lanes[data-fork][data-merged]>.mf-tx-lane:last-child::after{content:"";position:absolute;left:-14px;top:14px;bottom:0;width:1px;background:var(--mf-tx-rule)}
.mf-tx-lanes[data-fork]>.mf-tx-lane[data-status="running"]::before{--mf-tx-branch:var(--mf-tx-accent)}
.mf-tx-flow{position:absolute;left:-12px;top:13px;width:3px;height:3px;border-radius:50%;background:var(--mf-tx-accent);animation:mf-tx-flow 1.2s cubic-bezier(.16,1,.3,1) infinite}
@keyframes mf-tx-flow{from{transform:translateX(0);opacity:1}to{transform:translateX(10px);opacity:0}}
.mf-tx-lane-row{display:flex;flex-wrap:wrap;align-items:center;column-gap:10px;width:100%;padding:5px 0;border:0;border-radius:3px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.mf-tx-lane-row:hover .mf-tx-lane-title{text-decoration:underline;text-decoration-color:var(--mf-tx-rule);text-underline-offset:3px}
.mf-tx-led{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--mf-tx-node)}
.mf-tx-lanes:not([data-fork]) .mf-tx-led{display:none}
.mf-tx-lane[data-status="running"] .mf-tx-led{background:var(--mf-tx-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mf-tx-accent) 18%,transparent);animation:mf-tx-led 1.2s ease-in-out infinite}
.mf-tx-lane[data-status="failed"] .mf-tx-led,.mf-tx-lane[data-status="interrupted"] .mf-tx-led{background:transparent;box-shadow:inset 0 0 0 1.5px var(--chat-error)}
.mf-tx-lane[data-status="queued"] .mf-tx-led,.mf-tx-lane[data-status="waiting"] .mf-tx-led{background:transparent;box-shadow:inset 0 0 0 1.5px var(--mf-tx-node)}
@keyframes mf-tx-led{50%{opacity:.45}}
.mf-tx-lane-name{flex:0 1 210px;min-width:0;display:flex;align-items:baseline;gap:8px}
.mf-tx-lanes:not([data-fork]) .mf-tx-lane-name{flex:0 1 auto}
.mf-tx-lane-title{font-size:14px;line-height:1.4;font-weight:600;color:var(--chat-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-tx-lanes:not([data-fork]) .mf-tx-lane-title{font-weight:500}
.mf-tx-lane-act{flex:1 1 150px;min-width:0;font-size:13px;color:var(--mf-tx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-tx-lane[data-status="failed"] .mf-tx-lane-act,.mf-tx-lane[data-status="interrupted"] .mf-tx-lane-act{color:var(--chat-error)}
.mf-tx-lane-time{margin-left:auto;font-family:var(--mf-tx-mono);font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--mf-tx-muted)}
.mf-tx-lane[data-status="running"] .mf-tx-lane-time{color:var(--chat-text)}
.mf-tx-tag{font-family:var(--mf-tx-mono);font-size:9.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:1px 4px;border-radius:3px;box-shadow:inset 0 0 0 1px var(--mf-tx-rule);color:var(--mf-tx-muted)}
.mf-tx-lane-body{padding:4px 0 10px 17px;min-width:0}
.mf-tx-lanes:not([data-fork]) .mf-tx-lane-body{padding-left:0}
.mf-tx-term{margin:2px 0;padding:8px 12px;border-left:1px solid var(--mf-tx-rule);font:12px/1.6 var(--mf-tx-mono);color:var(--mf-tx-muted);white-space:pre-wrap;word-break:break-word;max-height:16rem;overflow:auto}
.mf-tx-term-out{color:var(--chat-text)}
.mf-tx-merge{position:relative;display:flex;flex-wrap:wrap;gap:4px 12px;margin-left:18px;padding:8px 0 0 4px;font-family:var(--mf-tx-mono);font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--mf-tx-muted)}
.mf-tx-merge::before{content:"";position:absolute;left:-14px;top:0;width:11px;height:15px;border-left:1px solid var(--mf-tx-rule);border-bottom:1px solid var(--mf-tx-rule);border-bottom-left-radius:6px}
.mf-tx-merge-lead{font-family:var(--chat-font-family,inherit);color:var(--chat-text)}
.mf-tx-merge-gain{color:var(--chat-secondary,var(--chat-text))}

.mf-tx-answer{position:relative;min-width:0}
.mf-tx-answer[data-after-work]{padding-top:6px}
.mf-tx-answer[data-sweep]::after{content:"";position:absolute;left:0;top:0;width:100%;height:1px;transform-origin:left;background:linear-gradient(90deg,var(--mf-tx-accent),transparent);animation:mf-tx-sweep 900ms cubic-bezier(.16,1,.3,1) both}
@keyframes mf-tx-sweep{0%{transform:scaleX(0);opacity:1}60%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}

@media (prefers-reduced-motion:reduce){
.mf-tx *,.mf-tx *::before,.mf-tx *::after{animation:none!important;transition:none!important}
.mf-tx-hud-beam,.mf-tx-pulse,.mf-tx-flow{display:none}
}
`;
