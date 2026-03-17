# @miiflow/assistant-ui

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
