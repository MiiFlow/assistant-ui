# @miiflow/assistant-ui

## 0.16.0

### Bug Fixes

- **`[VIZ:id]` markers rendered as raw text (`client/useMiiflowChat.ts`, `styled/Message.tsx`, `types/message.ts`)**: `Message` resolves an inline visualization by looking its id up in the `visualizations` it was given, and nothing in the package ever supplied that list — the SSE parser had no `visualization` branch, and `assistant_complete` was read for `metadata.sources` only. So every consumer of `useMiiflowChat` saw a literal `[VIZ:<hex>]` in the answer where the Adlyse app, which implements its own reader, drew a chart. The parser now collects `visualization` frames (replacing by id, since ids are content-derived and a re-render reuses one) and prefers the persisted `message.metadata.visualizations` at completion, because the server prunes renders the assistant left unembedded. `ChatMessage` gains `visualizations`, and `Message` falls back to `message.visualizations` when the prop is omitted — so `<Message message={msg} />` now renders inline charts with no host changes. `medias` and `artifacts` get the same message-level fallback.
- **`artifact` frames were dropped the same way (`client/useMiiflowChat.ts`)**: `ChatMessage.artifacts` was declared but never populated, so inline PDF/HTML cards never appeared for package consumers either. Now collected alongside visualizations.
- **Unresolvable inline markers reached the reader (`styled/Message.tsx`, `utils/inline-markers.ts`)**: the plain-text path stripped `[MEDIA:…]`, and then only when the message had media, so an unmatched `[VIZ:…]` or `[SA:…]` was rendered verbatim. All three are now stripped through one `stripInlineMarkers` helper (newly exported) that shares the parser's marker grammar.

### Features

- **`HANDLED_STREAM_EVENT_TYPES` export (`client`)**: the SSE frame types the parser acts on. Pinned in CI against the server's own `SSE_EVENT_TYPES`, so a frame added on the server can no longer be silently ignored here.

### Internal

- `MessageProps.message` is typed `ChatMessage` rather than `MessageData`. Every added field is optional, so a plain `MessageData` still satisfies it.

## 0.15.0

### Features

- **`LexicalChatInput` as a form field (`composer/LexicalChatInput.tsx`, `composer/hydrate.ts`)**: New optional props `submitOnEnter` (default `true`; `false` makes Enter insert a paragraph and Shift+Enter a line break, for a saved-prompt / scheduled-message editor that reads its value from `onChange`), `initialContent` (hydrated once on mount from the same plain-text projection the editor emits, so `/id:kind` substrings become chips again) and `resolveTokenLabel` (display label for rehydrated chips with opaque ids). `onSubmit` is now optional and the imperative handle gains `setContent(text)`. New export `$hydrateFromEncodedText` for hosts that mount their own `LexicalComposer`. Additive — the chat contract is unchanged.
- **Host-attested embed identity (`client/session.ts`, `client/types.ts`)**: `MiiflowChatConfig` gains `userData` — the exact JSON string your server HMAC-signed — and `initSession` now forwards it verbatim as `X-Embed-User-Data` alongside `X-Embed-Signature` and `X-Embed-Timestamp`. Previously `hmac` and `timestamp` were declared on the config and never sent, so a signed session could never verify and every embed fell back to anonymous. All three fields travel together or not at all; `userData` is passed through unserialized because re-encoding it would invalidate the signature. `hmac` is now documented as hex HMAC-SHA256 of `` `${userData}|${timestamp}` `` and `timestamp` as Unix seconds within five minutes of server time.
- **Container-driven KPI visualization (`styled/visualizations/KpiVisualization.tsx`)**: KPI cards now size from their own container — intrinsic `auto-fit` column templates and `cqi`-based `clamp()` value type — instead of Tailwind viewport breakpoints, which mis-sized every card because the chat panel is far narrower than the window. Cards shed columns and step their numbers down as the panel narrows rather than clipping, long labels and values wrap instead of overflowing, and the bento hero/satellite split stacks on container width. Rendering-only: the `KpiMetric` data contract is unchanged.

### Bug Fixes

- **Short user bubbles stretched to full width (`styled/Message.tsx`)**: A viewer bubble shares its wrapper with the timestamp and the invisible hover action bar, so a one-word message rendered a wide bubble padded with what looked like trailing whitespace. The bubble is now `w-fit` and end-aligned.
- **Command chip sat below the text baseline (`composer/CommandTokenView.tsx`)**: Command pills in the composer read as optically low against adjacent text; corrected with a 1px lift.

## 0.14.0

### Features

- **`auth_prompt` visualization (`styled/visualizations/AuthPromptVisualization.tsx`)**: New built-in visualization type that renders a "connect this integration" card when the assistant hits an unauthorized provider or OAuth-protected MCP server. Adds the `AuthPromptVisualization` component and `AuthPromptVisualizationProps` / `AuthPromptVisualizationData` / `authPromptVisualizationSchema` exports, extends `VisualizationType` with `"auth_prompt"`, and adds an `auth_connect` variant to `VisualizationActionEvent`. The package never runs OAuth itself — it reports intent through `onAction` and the host drives the flow; without `onAction` no button is drawn. Additive: hosts that register their own `auth_prompt` visualization are unaffected.
- **Rewritten message typography (`styles/prose.css`, `styled/MarkdownContent.tsx`)**: All `.chat-prose` rules now live in a single stylesheet shared by both `styles.css` and `styles-no-preflight.css` (previously two hand-maintained copies that had drifted), covering headings, lists, tables, blockquotes, inline and fenced code, heading anchors, and an inverted variant for user bubbles. `MarkdownContent` now applies `.chat-prose` on a wrapper element — under react-markdown v9 its `className` prop was silently dropped, so the stylesheet had been dead CSS. Agent prose spans the full thread width, single newlines render as line breaks (`remark-breaks`), and two new theming tokens are honored: `--chat-font-mono` and `--chat-message-font-size`. Hosts that compensated for the previously-unstyled prose may need to drop their overrides.
- **`isDarkSurface` on `ChatProvider` (`context/ChatProvider.tsx`)**: New optional prop telling the package whether the host surface is dark, for choices CSS variables can't express — currently the syntax-highlighting theme for code blocks. Defaults to `false`. Note: `MarkdownContent` no longer infers dark mode from the OS `prefers-color-scheme` (which rendered dark code blocks inside light apps); dark-surface hosts should pass `isDarkSurface` or the explicit `darkCodeTheme` prop.
- **`streamStartedAt` on `Message` / `ReasoningPanel` (`styled/ReasoningPanel.tsx`)**: New optional epoch-ms prop for the run's durable start time, so the live "thinking for Ns" counter stays correct when the panel remounts (e.g. navigating away from a thread and back) instead of restarting at zero. Omit it to keep the previous mount-relative timing.
- **Pending tool chip at block start (`client/useMiiflowChat.ts`)**: The SSE parser now handles the `is_tool_streaming` frame and shows a pending tool chip the moment a tool-use block opens, rather than waiting for argument generation to finish (tens of seconds of dead air on large tool calls). The later `is_tool_planned` frame merges into that chip by `tool_call_id`.
- **`findToolChunkIndex` export (`client/tool-chunk-matching.ts`)**: New exported helper plus `MatchableToolChunk` / `ToolFrame` types from the `client` entry, giving hosts that write their own SSE reducers the same tool-frame-to-chunk correlation the built-in parser uses. `StreamingChunk` gains an optional `toolCallId` field.
- **Inline image attachments (`styled/MessageAttachments.tsx`)**: Image attachments now render as inline thumbnails that open the shared `MediaLightbox` (Esc to close, arrow-key paging across all images in the message, body scroll-lock) instead of a file chip. Images whose URL fails to load fall back to the downloadable file chip. New optional `align` prop keeps thumbnails flush with right-aligned viewer messages.
- **Sub-agent transfer attribution (`styled/subagent/SubagentPanel.tsx`)**: `SubagentChunkData` gains an optional `transferred` flag for runs where a sub-agent was handed the turn and answered the user directly. When set, `SubagentPanel` still shows the sub-agent's tool work but notes who wrote the answer instead of repeating the reply that already appears as the message body. Additive and backward compatible.

### Bug Fixes

- **Attachment-only messages were swallowed (`composer/LexicalChatInput.tsx`, `styled/Message.tsx`)**: Sending an image with no caption did nothing — the Lexical input dropped submit intent when the text was empty. Submit intent is now emitted unconditionally and the owning composer decides sendability. The transcript had the mirror bug: a caption-less image vanished from history because the content row was gated on text; it now renders when there are attachments.
- **Composer stayed locked across conversations (`styled/MessageComposer.tsx`, `hooks/use-message-composer.ts`)**: The submit latch was held for the whole lifetime of the host's `onSubmit` promise, so a host that kept it open until the assistant finished locked the composer for every other conversation it was reused in. The latch now guards only the submit handshake, and a new optional `isStreaming` prop on `MessageComposer` / `useMessageComposer` is the per-conversation gate — it also blocks Enter, which previously bypassed the Stop-button swap. `WelcomeScreen` gains a matching optional `disabled` prop.
- **Parallel same-name tool calls collapsed into one row (`client/useMiiflowChat.ts`)**: When a turn ran several calls of the same tool at once, frames were matched by tool name, so all of them folded into a single chunk and the wrong row was completed. Id-bearing frames now match strictly by `tool_call_id`; only id-less legacy frames keep the most-recent-same-name fallback.
- **Preamble text left in the answer bubble (`client/useMiiflowChat.ts`)**: The parser now honors `is_answer_retraction`, clearing optimistically streamed answer tokens that the server retracts as pre-tool-call narration; the text re-arrives as a thinking chunk. The existing `is_tool_planned` clear remains as a backstop for older servers.

## 0.13.0

### Features

- **Copy + edit on user messages (`styled/Message.tsx`)**: Viewer (user) messages now surface a hover action bar — copy is always available, and an inline `UserMessageEditor` (Esc to cancel, Cmd/Ctrl+Enter to send) appears when the new optional `onEditSubmit` prop is provided, letting host apps wire ChatGPT-style edit-and-resubmit. Additive and backward compatible: the bar and editor never render without the prop, and existing `Message` / `MessageList` usage is unchanged.

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
