# @miiflow/assistant-ui

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
