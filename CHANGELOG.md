# @miiflow/assistant-ui

## 0.12.0

### Features

- **Full-width assistant responses (`styled/Message.tsx`)**: Assistant responses now fill the message column instead of being capped at 85% width, matching the reading layout of Claude / ChatGPT / Gemini. User messages are unchanged — still right-aligned, messenger-style, and capped at 85%. The reasoning panel above a response widens to full width so it aligns with the response body. Styling-only: the public `MessageList` / `Message` component APIs are unchanged.

## 0.11.0

**Breaking:** now requires **React 19** (`react`/`react-dom` `>=19`), up from `>=18`. The new scroll engine below is built on React 19. Projects still on React 18 should stay on `0.10.x` until they upgrade — this is published as a minor bump (not a patch) so `^0.10.0` ranges won't pick it up automatically.

### Features

- **Rebuilt chat scroll engine (`MessageList`)**: The styled `MessageList` now renders on the shadcn message-scroller engine (`@shadcn/react`) instead of the in-house `useAutoScroll` hook. Scrolling is more robust — it follows streamed output only while the reader is pinned to the live edge, preserves the reader's position when earlier content changes height (no yank-to-bottom mid-read), and opens the transcript at the latest turn. The public `MessageList` API is unchanged (`children` / `autoScroll` / `showScrollToBottom` / `className`); each direct child is wrapped in a scroll-anchored item internally, and the floating scroll-to-bottom button now derives its visibility from the engine's live-edge state. The legacy `useAutoScroll` hook and headless `MessageList` primitive remain exported for backward compatibility.

## 0.10.0

### Features

- **Instant-paint branding & session caching**: New `initialBranding` prop on `ChatProvider`/`useMiiflowChat` lets the host render the branded shell on first paint without waiting on the network (SSR-safe). The hook also caches the auth token + branding config per visitor in `client/session.ts`, so a returning visitor sees their real branding immediately and the backend can skip the public-key handshake (`Authorization: Bearer` fast path); a rejected stale token transparently falls back to the full handshake.
- **Init-time client tool registration**: New `tools` prop on `MiiflowChatConfig` folds known-at-mount client tool definitions into the `init` round-trip instead of a separate `registerTools()` call. Backward compatible — if the backend doesn't acknowledge the folded tools (`registeredTools`), the hook self-heals with a fallback registration call. Dynamic tools can still be added later via `registerTools()`.
- **Early-send message queuing**: Messages sent before the session finishes initializing now await the in-flight `init()` promise in `client/useMiiflowChat.ts` instead of being silently dropped, so the composer is safe to use the moment it renders.
- **Multi-question `ClarificationPanel`**: Agents can ask several related clarification questions in one panel with tabbed navigation, answered in any order, each with optional free-text input alongside predefined options. New exported `ClarificationQuestion` and `ClarificationAnswer` types capture answers as structured data (no text parsing) for deterministic server-side recording; the SSE parser falls back to the legacy single-question shape for old history.
- **`ComposerToolbar` component**: New reusable toolbar (exported from `styled/`) with an optional attach-file button, keyboard hint, and customizable trailing slot for send/stop actions, shared across `MessageComposer` and `WelcomeScreen` for consistent layout.
- **`LexicalChatInput` enhancements**: New `insertText` imperative handle lets toolbar buttons insert trigger characters (e.g. `/` or `@`) at the caret to open typeahead pickers, plus a new `placeholderClassName` prop; the placeholder now animates on change with Framer Motion (respecting `prefers-reduced-motion`).
- **Chat shell polish**: Smoother animations and transitions across `ChatHeader`, `ChatLayout`, `MessageComposer`, and `WelcomeScreen`; welcome-screen suggestion pills now render as compact bordered buttons with hover states.

## 0.9.0

### Features

- **`resolveCommandToken` provider prop**: New optional `ChatProvider` callback `resolveCommandToken(id, kind) => { label?, tag? }` lets the host app customize how inline command-token chips (e.g. `@<id>:ad-account` mentions) render in both the composer and rendered markdown. Returning `tag` replaces the default uppercase kind pill with a custom node (e.g. a platform logo); returning `label` overrides the id text. The wire format still only carries id + kind, so this is the integration point for resolving display info against the host's data layer.

## 0.8.1

### Bug Fixes

- **Embed WebSocket no longer reconnects forever with an expired token**: `useMiiflowChat`'s reconnect loop captured the session once and reused the same JWT on every retry, so once the token expired the client looped indefinitely with exponential-backoff-capped 403s (~one rejected handshake every 30s per stale tab). The reconnect path now reads the latest `sessionRef.current` on each attempt, detects handshake-time failures (`onclose` before `onopen`), refreshes the session via `initSession`, and caps consecutive auth refreshes at 3 before giving up.

### Security

- **Embed token no longer travels in the WebSocket URL**: `buildWebSocketUrl` previously appended `embed_token=<jwt>` as a query parameter, which leaked the JWT (and the tenant / assistant / thread IDs it carries) into server access logs and any intermediate proxies. The token is now passed via `Sec-WebSocket-Protocol` (`embed-token.<jwt>`) alongside a `miiflow.v1` marker protocol that the server echoes back. Requires server-side support for the new subprotocol; the server remains backward-compatible with older chat-ui versions that still send the token in the URL.

## 0.8.0

### Features

- **Refreshed tool approval UX**: `ToolApprovalPanel` redesigned with a raised CTA, pulsing header indicator, inline parameter-preview chips, keyboard shortcuts (Enter to approve, Escape to decline), and a `slots` prop for brand-aligned overrides. Approval panels now render full-width within the message column. A new `toolLabel` field on `ToolApprovalData` lets callers surface human-readable tool names.
- **Skill tagging in the composer**: New `CommandTokenNode`, `CommandTokenPlugin`, and `CommandTokenView` in `composer/` enable inline skill invocation via `/id:kind` syntax. `ChatComposerCommand` and `CommandProvider` types drive typeahead-based skill selection.
- **`@mode` / `@guideline` / `@ad_account` mentions**: Command-token system extended to recognize `@`-prefixed mentions in both composer input and rendered markdown (`MarkdownContent`, `MessageComposer`) so chips render consistently in drafts and history.
- **Multi-agent handoff infrastructure**: `useMiiflowChat` reworked to support multi-agent orchestration with a new `SubagentChunkData` streaming event, subagent status tracking, and nested rendering via a `SubagentPanel` component.
- **Reasoning panel revamp**: `ReasoningPanel` gains a `HeaderIndicator`, a one-shot halo animation on stream→complete, a "Thought for Xs" duration preview ahead of the summary, and renames output labels from "tools" to "sources" for clarity.
- **Clarification panel scrolling + answered state**: Long multi-part questions now scroll within a `max-h-[40vh]` container. `onSubmit` is optional and a new `answer` prop renders a read-only "answered" state for history scrollback.
- **Branding CSS variable expansion**: New customization points exposed via `useBrandingCSSVars` — `--chat-font-family`, `--chat-approval-accent`, `--chat-approve-bg`, `--chat-reject-bg-hover`, `--chat-clarification-accent`.
- **Internal tools hidden from timelines**: `tool_search` and `create_plan` are now suppressed from `EventTimeline`, `PlanTimeline`, and `ReasoningPanel` to reduce cognitive load when agents discover or plan in the background.
- **Preamble narration cleanup**: `useMiiflowChat` clears narration text emitted before a tool call so it isn't conflated with the final answer.

### Bug Fixes

- **Reasoning panel summary ordering**: "Thought for Xs" now precedes the summary preview in completed reasoning traces.
- **Tool approval layout**: Removed the 80% max-width constraint that visually de-emphasized approval gates inside long messages.

## 0.7.0

### Features

- **Artifact rendering**: New `styled/artifacts/` module with `ArtifactInlineCard`, `ArtifactList`, and a pluggable artifact `registry`. `Message` renders artifact attachments inline; streaming types (`types/streaming.ts`) gain artifact event variants so the agent's `ArtifactResult` marker (PDF, HTML, etc.) flows end-to-end.
- **Message feedback actions**: `MessageActionBar` gains `onReportIncorrect` and `onConfirmCorrect` handlers, with a portaled feedback popover offering category chips ("Incorrect or incomplete", "Wrong data", "Bad recommendation", etc.) plus free-text details. Wires the chat UI into the mistake-recording / hybrid-memory pipeline.

### Bug Fixes

- **`KpiVisualization` numeric change rendering**: Distinguish `0` / `null` / `undefined` for `metric.change`; numeric values now render with a signed prefix (`+1.2`), and `0` no longer hides the trend chip.

## 0.6.0

### Features

- **Table `media` column type**: Render image/video thumbnails inline in tables. Cells accept raw URLs, media objects, or `media_ref:<id>` sentinels that resolve against the message-level `medias` bag. Clicks open a table-wide lightbox that navigates across rows and columns.
- **Message-level media grid + lightbox**: Multi-media messages render as a responsive grid of clickable tiles. Lightbox is portaled into `document.body` (escapes transformed ancestors), locks body scroll, and supports keyboard navigation.
- **Per-cell hover popover**: Replaced the row-wide hover card with a per-cell popover — selectable text, icon-only copy button, fit-content width, viewport-flip when near the edge. Long cell contents line-clamp on the inner `div` so table layout is preserved.
- **`ToolApprovalPanel`**: Human-in-the-loop tool approval UI for confirming mutating tool calls before execution.
- **Streaming min-height**: New `useStreamingMinHeight` hook keeps messages from visually collapsing mid-stream; paired with a `measureMessage` utility.
- **Image compression utility**: `utils/compress-image.ts` for client-side image resizing before upload.
- **System messages in client tools**: Client-side tool handlers now receive system messages in addition to user/assistant turns.
- **Citation + markdown tweaks**: Small UX refinements to `CitationSources` and `MarkdownContent` rendering.

### Bug Fixes

- Add `"media"` to the table column-type zod enum so payloads with media columns pass schema validation (fixes "Invalid table visualization data" error)
- Resolve `media_ref:<id>` cell values against the message's `medias` array so thumbnails render instead of broken image icons
- Plumb `medias` through `Message` → `VisualizationRenderer` → `TableVisualization` so visualizations can see the media bag

## 0.5.2

### Features

- **Floating composer**: Composer no longer reserves a fixed space with a top border; messages scroll naturally behind it with a gradient fade mask on the message list
- **Consistent send button states**: Unified dark button style (`gray-900`/`zinc-100`) across disabled, enabled, hover, and streaming states — replaces the inconsistent grey/white/blue transitions
- **Streaming stop indicator**: Stop button now shows a subtle background flash animation to indicate active streaming

### Bug Fixes

- Fix stop button icon being invisible in dark mode (black icon on black background)

## 0.5.0

### Features

- **Media rendering support**: Export `MediaChunkData` type from `styled` entry point
- **Inline image/video display**: `Message` component renders media items (images, videos) returned by tool executions (e.g., image generation tools) below the message text

### Bug Fixes

- Fix media items not rendering in `Message` component when passed via `medias` prop

## 0.4.0

- Add CI-based bidirectional sync + release v0.4.0
- Add `@miiflow/chat-ui/client` export with `useMiiflowChat` hook, session management, token utils, tool validation
- Add `BrandingData` type and `useBrandingCSSVars` hook
- Refactor `headless.tsx` to use `useMiiflowChat` instead of inline SSE streaming
