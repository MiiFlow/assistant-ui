# @miiflow/assistant-ui

## 0.20.0

The ordered agent transcript is redrawn as an activity rail: where execution is now, and what ran at the same time.

### Features

- **Activity header (`styled/transcript/RunHeader.tsx`)**: the full-width grey toggle is replaced by a content-width strip — mark, state, a ticking clock, and live agent/call counts — with a travelling line under it while the run works. On completion it reads "Worked for …" and folds the activity above the answer, as before.
- **Rail and parallel lanes (`styled/TranscriptFlow.tsx`, `styled/transcript/WorkLanes.tsx`)**: speech, reasoning and work sit on one rail; only the live slot carries the activity accent. Work that ran concurrently forks into lanes — specialists dispatched from one step, or tool calls whose measured run intervals overlap — each with a status light, current action and timer, and merges into one line with wall time, total work and the speed-up. Any lane expands inline: a specialist's steps, or a tool's call and output.
- **Customisation**: `Message` takes `activityMark(state, { live })` for a host mark (the package draws an unbranded one in `--chat-activity`), and `activityLabels` to override any string (`DEFAULT_ACTIVITY_LABELS`, `ActivityLabels`, `ActivityMarkRenderer`, `ActivityState` are exported). A host that only sets `waitingMark` keeps it while the run works. New optional CSS variables: `--chat-surface` (tokens.css), `--chat-activity`, `--chat-rule`; `BrandingData.fontFamilyMono` maps to `--chat-font-mono`. Every connector is drawn opaque (text mixed into `--chat-surface`), so crossing lines never darken.
- **Motion only where it carries information**: entrances play only for slots that arrive while the reader watches; a transcript loaded finished mounts still; `prefers-reduced-motion` stops all of it.

### Bug Fixes

- **A second, empty avatar under every running transcript with specialists (`styled/Message.tsx`)**: the legacy reasoning panel's standalone avatar was gated on reasoning steps but not on the panel itself, so it rendered beside the transcript that replaced the panel.

## 0.19.0

Entity references: an assistant's mention of a host-side object (a schedule, a workflow run, a report…) renders as a named chip that navigates in-app and can carry a hover card.

### Features

- `EntityText`: plain-text values (a table visualization's string cells) render their entity ids as the same chips the Markdown link form gets; `EntityReference` reads the host resolver from `ChatRenderContext` when rendered outside a Markdown body. `TableVisualization` string cells use it.
- **`entity:` links (`styled/markdown/entity-references.tsx`)**: a Markdown link whose destination is `entity:<kind>/<id>` renders as a chip instead of an anchor. The wire form carries only kind, id and the label the host's server baked in; the host supplies the rest through `ChatProvider`'s new `resolveEntity({ kind, id, label })` — `label`, `icon`, `href`, `onNavigate` (in-app navigation; modified clicks still follow `href`) and `renderHoverCard(trigger)`. With no resolver, or an unknown kind, the chip still shows the label: an unresolved reference never renders as a dead link or a raw id.
- **Bare ids while streaming**: `ChatProvider`'s `entityPrefixes` (prefix → kind, e.g. `{ sched_: "schedule" }`) lets the renderer promote a bare id — the model's own text before the host links it, or a message persisted before linking existed — to the same chip. Ids inside code blocks, existing links and URLs are left alone; an inline code span that is exactly one id is promoted. Hand a stable object: the regex is cached per map identity.
- `ENTITY_HREF_SCHEME`, `entityHref`, `parseEntityHref` and the `EntityResolver` / `EntityResolution` / `EntityReferenceInfo` types are exported from the package root.

## 0.18.0

Streaming without layout shift, and an embedded widget that recovers from a lost connection instead of going dead. Plus mobile composer and keyboard/screen-reader fixes.

### Bug Fixes

- **Every token remounted the whole answer (`styled/MarkdownContent.tsx`)**: the react-markdown `components` map was built inline on each render, which hands React a new component type for every `<p>`, `<li>` and `<code>` — and React answers a new type by unmounting and rebuilding the subtree. Every streamed delta re-parsed the full document and tore its DOM down; images re-requested, code re-highlighted, text selection lost. The overrides are now defined once at module scope (`styled/markdown/components.tsx`) and read their inputs from a render context. The document is split into top-level blocks (`marked` lexer) rendered by a memoised `MarkdownBlock`, so only the block still receiving text re-parses.
- **Completion remounted it again (`styled/Message.tsx`)**: the body swapped from a `StreamingText` wrapper to a bare `MarkdownContent` when `isStreaming` flipped. One tree now, for both states; `StreamingText` is deprecated. The timestamp/action row is in the layout from the first token, invisible, so nothing below the answer moves when it lands.
- **Unterminated markdown flashed (`styled/markdown/repair.ts`)**: `**bold` showed as asterisks, then re-laid-out bold when the close arrived; an open fence swallowed the rest of the message as prose-turned-code. The live block's tail is repaired with `remend` and an open fence is closed, so the styled form appears from the first token.
- **One React commit per model token (`client/useMiiflowChat.ts`)**: `onMessageUpdate` fired per SSE frame. Frames are now coalesced to one update per animation frame (`client/frame-scheduler.ts`); a commit is a snapshot of the accumulators, so frame order cannot be inverted by batching. `parseSSEStream` takes `{ schedule }` for tests (`scheduleSync` restores per-frame updates).
- **The reasoning panel folded from the full trace, unlocked (`styled/reasoning/ReasoningStream.tsx`)**: at completion it painted every step open for a frame, then folded, with no scroll lock. It now folds the window that was on screen and locks the transcript for the fold. It also folds the moment the answer starts (`answerStarted`, derived by `Message` from the text), so nothing above the streaming text changes height while it types; the header keeps counting and offers "Show N steps". A trace the reader opened stays open.
- **Three waiting affordances swapped before the first token**: typing dots, then a thinking row, then the panel — each a different height. The panel now owns the whole run for an assistant row: a waiting line (`waitingLabel`, `waitingMark`), the live steps and the finished summary are three faces of one element with a constant header height.
- **One lost connection left the widget dead (`client/useMiiflowChat.ts`, `client/network.ts`)**: browsers report an unreachable backend as a bare `TypeError` ("Load failed" on iOS), and the hook treated it as final: init failed once and never retried, and a message sent afterwards was silently dropped. Init now retries network failures, 5xx and 429 with backoff (up to 30s) and immediately on the browser's `online` event; a cached token is dropped only when the server actually rejects it. `error` clears as soon as init connects, and a message sent before then waits for the session instead of vanishing.
- **A failed send said "Sorry, I encountered an error" whatever happened (`client/failure-text.ts`)**: a network failure now says either that the message may not have been sent or that the reply was cut off after the server received it, in the transcript and in `error` alike. Nothing is resent automatically — the server does not deduplicate turns, so a replay could run a turn (and its tool actions) twice. Stop pressed while a send waits for its session removes that turn at once and `onUserMessageCreated` never fires; a stopped send no longer clears a newer send's streaming state.
- **A websocket reconnect could move the conversation to a new, empty thread (`client/useMiiflowChat.ts`, `client/session.ts`)**: any handshake failure was treated as a bad token and re-ran init, which starts a fresh thread once the current one has messages and drops the registered client tools; after three failures it stopped reconnecting for good. The socket is now keyed on the thread, so a token update no longer closes a healthy connection. An expiring token is refreshed through `/api/embed/refresh`, and a refreshed token is applied only to the thread it was issued for (a refresh that lands after `startNewThread` is dropped, in the websocket and the media loader alike). After repeated failures the widget checks the session instead of guessing: it keeps waiting while the backend is unreachable, restarting or rate limited, and gives up — with a log line — only when the session is refused or checks keep succeeding without the socket opening. It reconnects immediately on `online`. Concurrent refreshes of one token share a single request. Requires a backend whose refresh endpoint re-issues for the token's own thread; against an older one, an older tab of a visitor with several tabs open gives up its socket rather than switching threads.
- **Phones zoomed into the composer on focus (`composer/LexicalChatInput.tsx`, `styled/MessageComposer.tsx`, `styled/WelcomeScreen.tsx`)**: iOS zooms into any focused field under 16px, and the editor was 14px (the welcome composer re-applied 14px on top). The editor and its placeholder are now 16px below the `md` breakpoint, desktop keeps 14px, and the welcome composer is 16px at every width.
- **The composer could be squeezed off screen (`styled/ChatLayout.tsx`)**: in a short viewport — a phone with the keyboard open — the footer shrank along with the message list. It no longer shrinks; only the history gives up height.
- **The clarification panel could not be completed from the keyboard (`styled/ClarificationPanel.tsx`)**: radio groups skipped choices, Enter selected nothing, focus was lost when the question changed, and Enter in the last custom answer did nothing. Choices are now toggle buttons (`aria-pressed`), so Tab reaches each one and Enter or Space selects it; focus follows the active question; Enter in a custom answer advances or submits; question tabs are named ("Question 2 of 3, answered") and tied to their panels. Hosts that styled or queried the old `radio`/`checkbox` inputs need to update.
- **Screen readers announced an unnamed text box (`composer/LexicalChatInput.tsx`)**: the placeholder is painted over the editor, not an attribute. The editor now carries `aria-label` and `aria-multiline` from the new `ariaLabel` prop (default "Message"); pass a stable name, not a rotating placeholder.
- **A tool step with no description showed its raw name (`styled/reasoning/tool-label.ts`)**: `apply_report_patch` rendered in monospace in the step list, event timeline and live label. It now reads "Apply report patch" in body text, with the raw name kept in the hover title; `RunStepTool.label` holds the readable name when `isSlugOnly` is true.
- **`useStreamingMinHeight` reserved the wrong height and dropped it at completion**: it measured plain text at line-height 1.5 while prose renders at 1.65 under a 37em cap, ignored block margins, bailed on fences, and released in one frame at the end. Removed; the transcript reserves a live turn's space from the viewport instead (see `MessageList`). `measureMessageHeight` / `clearMeasurementCache` remain exported but are deprecated.

### Features

- **Anchored turns (`styled/MessageList.tsx`)**: opt a turn in with `data-message-id` and `data-scroll-anchor="true"` on the direct child and the user's message pins near the top while the answer streams down into reserved space (`--chat-turn-fill`), ChatGPT-style. Hosts that pass plain rows keep the following behaviour. New props `scrollPreviousItemPeek` and `defaultScrollPosition`.
- **Per-word reveal (`styled/markdown/rehype-animate-words.ts`)**: newly arrived words in the live block fade in over 160ms (`--chat-word-in-ms`). A block keeps its (inert) word spans once it has streamed, so completion re-renders nothing; blocks that never streamed carry no extra markup. Honours reduced motion. `MarkdownContent` gains `isStreaming` and `animateText`.
- **Lists re-parse one item at a time (`styled/markdown/split-blocks.ts`)**: a tight list is one `<ul>`/`<ol>` built around per-item memoised blocks, so a growing list — the commonest answer shape — re-parses only the item still receiving text instead of the whole list on every frame.
- **`ChatRenderContext` (`context`)**: the render inputs (`resolveCommandToken`, `isDarkSurface`, `onVisualizationAction`, `viewerRole`) on their own context, so a message body does not re-render when the message list changes.
- `Message` is memoised. Pass referentially stable callbacks to benefit.
- **`NetworkError`, `isNetworkError` (`client`)**: tell "could not reach the backend" apart from an answer the backend gave. Every embed call — `initSession`, `createThread`, `uploadFile`, `sendToolResult` and the rest — now rejects with `NetworkError` when the connection fails, including a response body that drops midway, where it used to reject with a bare `TypeError`. HTTP failures now include the response body in their message.
- **`humanizeToolName` (`styled`)**: the readable form of a tool's name, as used by the step list.

### Deprecations

- `StreamingText`, `justCompleted`, `measureMessageHeight`, `clearMeasurementCache` — removed in the next major.

## 0.17.0

### Bug Fixes

- **Every message remounted twice per turn (`client/useMiiflowChat.ts`, `types/message.ts`)**: the hook replaced the `assistant-pending-…` placeholder with a freshly minted `assistant-…` message on the first frame, then renamed that to the server's id at completion. Consumers key rows on `msg.id` (as the README shows), so React unmounted and remounted the whole message both times — the second as a hard cut from the live reasoning steps to the finished answer: `StreamingText` swapped for `MarkdownContent`, the reasoning panel remounted collapsed with its "already seen" and expanded state reset, and the reserved streaming height released, all in one commit. A message now keeps the id it was created with for its whole life; the persisted id arrives as the new `ChatMessage.serverId` (on the user message too, in place of the mid-stream id rewrite). Send that one back to the server; key on `id`. A turn that fails after content has streamed now keeps the partial message, finalized, ahead of the error bubble instead of leaving it marked streaming; a turn that ends without a single frame touching the message drops the placeholder instead of leaving it waiting forever.
- **Blank row instead of the waiting indicator during internal tools (`styled/Message.tsx`, `styled/reasoning/ReasoningStream.tsx`)**: `Message` opened the reasoning panel as soon as any reasoning chunk existed, but `buildRunSteps` drops `tool_search`, `create_plan`, `unknown` and `dispatch_assistant`, and the panel renders nothing for zero steps — so a turn opening with `tool_search` (most turns on a tool-heavy assistant) hid the indicator and drew nothing until the first real tool. The gate is now the built steps, computed once in `Message` and handed to `ReasoningStream` through a new `steps` prop.
- **Reasoning steps snapped shut at completion unless the host passed `justCompleted` (`styled/reasoning/ReasoningStream.tsx`)**: with the id stable, the streaming→complete edge now happens on one component instance and `ReasoningStream` observes it itself, so the fold into "Thought for …" runs for every consumer. `justCompleted` remains for hosts that still remount the completed message.
- **The setup status line never reached `<Message>` (`styled/Message.tsx`)**: "Getting started…" was exposed only as `statusText` on the hook, with no `Message` prop to give it to, so the waiting state showed a bare dot. The streaming message now carries `ChatMessage.statusText` and `Message` renders it as the indicator's label; a `waitingLabel` prop overrides it.
- **`useMiiflowChat` dropped `visualizations` / `medias` / `artifacts` from its public messages (`client/useMiiflowChat.ts`)**: the 0.16.0 `Message` fallback to `message.visualizations` never reached hook consumers, because the hook's `ChatMessage` mapping omitted the three fields it had collected. Mapped now.

### Internal

- `parseSSEStream` (the test seam) takes `{ optimisticId, assistantMsgId }` in place of a session and an id, never creates a message (`onMessageCreate` is gone), and reports the persisted user message through `onUserMessagePersisted` rather than `onUserMessageIdUpdate`.

## 0.16.0

### Bug Fixes

- **`[VIZ:id]` markers rendered as raw text (`client/useMiiflowChat.ts`, `styled/Message.tsx`, `types/message.ts`)**: `Message` resolves an inline visualization by looking its id up in the `visualizations` it was given, and nothing in the package ever supplied that list — the SSE parser had no `visualization` branch, and `assistant_complete` was read for `metadata.sources` only. So every consumer of `useMiiflowChat` saw a literal `[VIZ:<hex>]` in the answer where the Adlyse app, which implements its own reader, drew a chart. The parser now collects `visualization` frames (replacing by id, since ids are content-derived and a re-render reuses one) and prefers the persisted `message.metadata.visualizations` at completion, because the server prunes renders the assistant left unembedded. `ChatMessage` gains `visualizations`, and `Message` falls back to `message.visualizations` when the prop is omitted — so `<Message message={msg} />` now renders inline charts with no host changes. `medias` and `artifacts` get the same message-level fallback.
- **`artifact` frames were dropped the same way (`client/useMiiflowChat.ts`)**: `ChatMessage.artifacts` was declared but never populated, so inline PDF/HTML cards never appeared for package consumers either. Now collected alongside visualizations.
- **Unresolvable inline markers reached the reader (`styled/Message.tsx`, `utils/inline-markers.ts`)**: the plain-text path stripped `[MEDIA:…]`, and then only when the message had media, so an unmatched `[VIZ:…]` or `[SA:…]` was rendered verbatim. All three are now stripped through one `stripInlineMarkers` helper (newly exported) that shares the parser's marker grammar.
- **`~approx~` struck through everything between two tildes (`styled/MarkdownContent.tsx`)**: `remark-gfm` defaults `singleTilde` to `true`, which GitHub itself does not — a lone `~` opens strikethrough. Assistants write `~` for "approximately" constantly, so any answer carrying two of them ("(~$25 AOV implied, 0.20-0.33x ROAS) … (~$810 AOV implied)") rendered the whole span struck out. The plugin is now configured with `singleTilde: false`, so only `~~text~~` strikes.

### Features

- **`HANDLED_STREAM_EVENT_TYPES` export (`client`)**: the SSE frame types the parser acts on. Pinned in CI against the server's own `SSE_EVENT_TYPES`, so a frame added on the server can no longer be silently ignored here.
- **KPI bento redesign (`styled/visualizations/KpiVisualization.tsx`)**: The bento layout drops the per-index rainbow palette — tinted gradient backgrounds, colored accent stripes, glow shadows, colored labels and a gradient-filled sparkline — for one neutral card: a single gray border, a neutral uppercase label, and a sparkline stroked in `currentColor`. Color now means something, because only the trend carries it, and as text rather than a filled pill. The rhythm tightens with it: gaps 16px → 12px, explicit card min-heights, `mt-auto` bottom-aligning the trend row so hero and satellites share a baseline, retuned `cqi` value clamps, and a wider satellite min track (140px → 168px). Rendering-only — the `KpiMetric` data contract is unchanged.

### Internal

- `MessageProps.message` is typed `ChatMessage` rather than `MessageData`. Every added field is optional, so a plain `MessageData` still satisfies it.

## 0.15.0

### Features

- **Reasoning rendered as steps in the transcript (`styled/reasoning/`)** *(recorded after the fact — shipped in 0.15.0 without an entry)*: `Message` renders live reasoning through the new `ReasoningStream`: a rolling window of the last three steps while the run is live, older ones fading out above, collapsing to one "Thought for 2:14 · 6 steps" line once it ends. A step is a thought plus the tool calls it justified, built by the exported `buildRunSteps` (with `INTERNAL_TOOLS` / `isInternalTool`) — the single grouping rule shared with durable-trace replay. New `Message` prop `justCompleted`, for hosts whose completed message is a different element from the streaming one.
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
