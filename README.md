# @miiflow/assistant-ui

React components and hooks for building custom Miiflow chat interfaces. Install as an npm package for full control over layout, styling, and behavior.

## Installation

```bash
npm install @miiflow/assistant-ui
```

**Peer dependencies:** `react >= 19`, `react-dom >= 19`, `zod >= 3`. Optionally `lexical >= 0.20` and `@lexical/react >= 0.20` — required only if you use the Lexical-based `MessageComposer` / `WelcomeScreen` input or the `/composer` entry. React 18 projects must stay on `0.10.x`.

The styled components use [TailwindCSS](https://tailwindcss.com/). If your project doesn't use Tailwind, import the pre-built CSS instead:

```ts
import "@miiflow/assistant-ui/styles.css";
```

If you're embedding inside an existing page and want to avoid Tailwind's preflight (CSS reset) affecting the host page:

```ts
import "@miiflow/assistant-ui/styles-no-preflight.css";
```

## Quick Start

```tsx
import { useMiiflowChat } from "@miiflow/assistant-ui/client";
import {
  ChatProvider,
  ChatLayout,
  ChatHeader,
  MessageList,
  Message,
  MessageComposer,
  WelcomeScreen,
} from "@miiflow/assistant-ui/styled";
import "@miiflow/assistant-ui/styles.css";

function Chat() {
  const {
    messages,
    isStreaming,
    streamingMessageId,
    sendMessage,
    uploadFile,
    stopStreaming,
    startNewThread,
    branding,
    brandingCSSVars,
    loading,
  } = useMiiflowChat({
    // Find these in your Miiflow dashboard under Settings > Embed
    publicKey: "pk_live_...",
    assistantId: "ast_...",
  });

  if (loading) return <div>Loading...</div>;

  const isEmpty = messages.length === 0;

  return (
    <ChatProvider
      messages={messages}
      isStreaming={isStreaming}
      streamingMessageId={streamingMessageId}
      onSendMessage={(content) => sendMessage(content)}
      onStopStreaming={stopStreaming}
    >
      <div style={{ height: "100vh", ...brandingCSSVars }}>
        <ChatLayout
          isEmpty={isEmpty}
          header={
            <ChatHeader
              title={branding?.customName ?? "Assistant"}
              logo={branding?.chatbotLogo}
              actions={[
                { id: "new", label: "New chat", onClick: startNewThread },
              ]}
            />
          }
          welcomeScreen={
            <WelcomeScreen
              welcomeText={branding?.welcomeMessage}
              placeholders={branding?.rotatingPlaceholders}
              suggestions={branding?.presetQuestions}
              onSubmit={(message) => sendMessage(message)}
              onSuggestionClick={(s) => sendMessage(s)}
              disabled={isStreaming}
            />
          }
          messageList={
            <MessageList>
              {messages.map((msg) => (
                <Message
                  key={msg.id}
                  message={msg}
                  reasoning={msg.reasoning}
                  suggestedActions={msg.suggestedActions}
                  onSuggestedAction={(a) => sendMessage(a.value)}
                />
              ))}
            </MessageList>
          }
          composer={
            <MessageComposer
              onSubmit={(content, _files, attachmentIds) =>
                sendMessage(content, attachmentIds)
              }
              onUploadFile={uploadFile}
              isStreaming={isStreaming}
              onStopStreaming={stopStreaming}
              placeholder={branding?.chatboxPlaceholder}
            />
          }
        />
      </div>
    </ChatProvider>
  );
}
```

Note the small signature adapters: the hook's `sendMessage` takes `(content, attachmentIds?)`, while `ChatProvider.onSendMessage` passes `(content, attachments?: File[])` and `MessageComposer.onSubmit` passes `(content, attachments?, attachmentIds?)` — wrap them as shown rather than passing `sendMessage` directly.

## Configuration Reference

Pass a `MiiflowChatConfig` object to `useMiiflowChat`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `publicKey` | `string` | Yes | Public API key from the Miiflow dashboard |
| `assistantId` | `string` | Yes | Assistant ID from the Miiflow dashboard |
| `userId` | `string` | No | User ID for identity tracking |
| `userName` | `string` | No | User display name |
| `userEmail` | `string` | No | User email |
| `userMetadata` | `string` | No | JSON string of custom user metadata |
| `userData` | `string` | No | The exact JSON string your server signed, sent verbatim. See [Verified identity](#verified-identity-hmac) |
| `hmac` | `string` | No | Signature over `userData` + `timestamp`. See [Verified identity](#verified-identity-hmac) |
| `timestamp` | `string` | No | Unix seconds (string) used in the signature |
| `baseUrl` | `string` | No | API origin override (default: `https://api.miiflow.ai`). A trailing `/api` is stripped; the client appends `/api/...` per request |
| `webSocketUrl` | `string` | No | WebSocket URL for tool invocations (auto-derived from `baseUrl` if not set) |
| `initialBranding` | `BrandingData` | No | Branding rendered before session init so the shell paints instantly (SSR-safe). Server branding overrides it once init resolves |
| `tools` | `ClientToolDefinition[]` | No | Client tools folded into the init round-trip instead of a separate `registerTools()` call |
| `onToolInvocationFallback` | `(invocation: ToolInvocationRequest) => Promise<boolean>` | No | Handles tool invocations with no local handler (multi-widget routing); return `true` if handled |
| `onUserMessageCreated` | `(message: { id: string; content: string }) => void` | No | Fired when a user message is created |
| `onAssistantMessageComplete` | `(message: { id: string; content: string }) => void` | No | Fired when an assistant stream completes |

## Verified identity (HMAC)

By default a session is anonymous: the widget keys it on a random id in
`localStorage`, and `userId`/`userName`/`userEmail` are untrusted hints the
browser could set to anything. That is fine for a public help widget.

If the assistant should act **as a signed-in person** — see their data, or use
a connected integration on their behalf — the browser cannot be the one making
that claim. Sign the identity on your server instead:

```js
// SERVER-SIDE ONLY. The private key must never reach the browser: anyone
// holding it can impersonate any of your users to the assistant.
import crypto from "node:crypto";

const userData = JSON.stringify({
  user_id: "your-internal-user-id",   // required — the session is keyed on this
  name: "Ada Lovelace",               // optional
  email: "ada@example.com",           // optional
  tenant_scope: "acme-hvac",          // optional — see below
});
const timestamp = String(Math.floor(Date.now() / 1000));
const hmac = crypto
  .createHmac("sha256", process.env.MIIFLOW_EMBED_PRIVATE_KEY)
  .update(`${userData}|${timestamp}`)
  .digest("hex");
```

Pass all three to the hook and send nothing else:

```tsx
useMiiflowChat({ publicKey, assistantId, userData, hmac, timestamp });
```

Details that matter:

- **The signature covers the exact bytes of `userData`.** Pass the same string
  you signed — re-serializing it, even to equivalent JSON, invalidates the
  signature. This is why `userData` is a string you supply rather than
  something the SDK assembles for you.
- **All three fields travel together.** Send a partial set and the session
  falls back to anonymous rather than failing loudly.
- **`timestamp` must be within 5 minutes** of server time. Sign per page load,
  not once at build time.
- **`user_id` is the session identity.** Two different signed-in users on the
  same browser get separate sessions and separate chat histories, and neither
  can reach the other's — an unsigned request cannot claim a signed identity.
- **`tenant_scope`** names which of *your* tenants (workspace, shop, account)
  the session is acting for, when one deployment serves many. It scopes the
  credentials the assistant uses, so a session can only reach the tenant it was
  signed for. Omit it if your users belong to exactly one.

Rotate the private key from the Miiflow dashboard if it is ever exposed.

## Connecting to a Custom Backend

By default, the hook connects to `https://api.miiflow.ai`. To point to your own backend, pass a `baseUrl`:

```tsx
useMiiflowChat({
  publicKey: "pk_live_...",
  assistantId: "ast_...",
  baseUrl: "https://your-server.example.com",
  // webSocketUrl is auto-derived from baseUrl; override if needed:
  // webSocketUrl: "wss://your-server.example.com/ws",
});
```

Pass the bare origin — the client appends `/api/...` to each request itself (a trailing `/api` on `baseUrl` is stripped). Your backend must implement the same API contract as the Miiflow platform (session init, SSE streaming, file upload, and tool-result endpoints).

## Hook API — `useMiiflowChat`

```ts
import { useMiiflowChat } from "@miiflow/assistant-ui/client";

const result = useMiiflowChat(config);
```

### State

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `ChatMessage[]` | Messages in the conversation |
| `isStreaming` | `boolean` | Whether a response is currently streaming |
| `streamingMessageId` | `string \| null` | ID of the message being streamed |
| `loading` | `boolean` | Whether the session is still initializing |
| `error` | `string \| null` | Error message if initialization or sending failed |
| `session` | `EmbedSession \| null` | Current session data |
| `branding` | `BrandingData \| null` | Branding configuration from the dashboard |
| `brandingCSSVars` | `CSSProperties` | CSS custom properties derived from branding |

### Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `sendMessage` | `(content: string, attachmentIds?: string[]) => Promise<void>` | Send a message; queued if init hasn't resolved yet |
| `uploadFile` | `(file: File) => Promise<string>` | Upload a file and get an attachment ID |
| `removeUploadedAttachment` | `(attachmentId: string) => void` | Drop uploaded-attachment metadata when the user removes it pre-send |
| `stopStreaming` | `() => void` | Abort the in-flight stream, preserving partial content |
| `startNewThread` | `() => Promise<string>` | Start a new conversation thread; re-registers client tools |
| `registerTool` | `(tool: ClientToolDefinition) => Promise<void>` | Register a client-side tool |
| `registerTools` | `(tools: ClientToolDefinition[]) => Promise<void>` | Register multiple tools |
| `sendSystemEvent` | `(event: SystemEvent) => Promise<void>` | Send an invisible system event (triggers a reply) |
| `sendPageContext` | `(context: PageContext) => Promise<void>` | Append hidden page context to the thread (no reply) |
| `handleToolInvocation` | `(invocation: ToolInvocationRequest) => Promise<boolean>` | Execute a tool invocation; `true` if handled locally |
| `updateSession` | `(session: EmbedSession) => void` | Replace the session externally (e.g. after token refresh) |

## Components Reference

### `ChatProvider`

Wraps children and provides chat context via React context.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | **Required.** Subtree |
| `messages` | `ChatMessage[]` | — | **Required.** Messages to display |
| `onSendMessage` | `(content: string, attachments?: File[]) => Promise<void>` | — | **Required.** Message send handler |
| `isStreaming` | `boolean` | `false` | Whether a response is streaming |
| `streamingMessageId` | `string \| null` | `null` | ID of the streaming message |
| `viewerRole` | `ParticipantRole` | `"user"` | Viewer's role (determines message alignment) |
| `onStopStreaming` | `() => void` | — | Stop streaming handler (wire to the hook's `stopStreaming`) |
| `onRetryLastMessage` | `() => Promise<void>` | — | Retry last message handler (host-implemented) |
| `customData` | `Record<string, unknown>` | — | Arbitrary data passed through context |
| `onVisualizationAction` | `(event: VisualizationActionEvent) => void` | — | Callback for form/card/auth interactions |
| `resolveCommandToken` | `(id: string, kind: string) => { label?: string; tag?: ReactNode } \| undefined` | — | Customize inline command-token chip rendering |
| `isDarkSurface` | `boolean` | `false` | Tells the package the host surface is dark — drives choices CSS variables can't express, currently the code-block syntax theme |

### `ChatLayout`

Handles the empty-to-active state transition with crossfade animation. Accepts render slots for each section.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isEmpty` | `boolean` | — | **Required.** Whether the chat has no messages |
| `header` | `ReactNode` | — | Header slot (rendered in both states) |
| `welcomeScreen` | `ReactNode` | — | Content for empty state |
| `messageList` | `ReactNode` | — | Message list for active state |
| `composer` | `ReactNode` | — | Composer for active state |
| `footer` | `ReactNode` | — | Extra content between list and composer |
| `className` | `string` | — | Additional CSS classes |

### `WelcomeScreen`

Empty state with rotating placeholder text and suggestion cards.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholders` | `string[]` | `[]` | Rotating placeholder strings |
| `suggestions` | `string[]` | `[]` | Preset suggestion cards |
| `onSubmit` | `(message: string, files?: File[]) => void` | — | Submit handler for built-in input |
| `onSuggestionClick` | `(suggestion: string) => void` | — | Suggestion card click handler |
| `welcomeText` | `string` | `"How can I help you today?"` | Heading text |
| `supportsAttachments` | `boolean` | — | Show the attach button on the built-in input |
| `disabled` | `boolean` | — | Block the built-in input (e.g. while streaming). Ignored when `composerSlot` is set |
| `composerSlot` | `ReactNode` | — | Override default input with custom composer |
| `commandProvider` | `CommandProvider \| null` | — | Slash-command typeahead provider |
| `commandProviders` | `CommandProvider[]` | — | Multiple trigger providers; takes precedence over `commandProvider` |
| `assistantAvatar` | `string` | — | Avatar URL; when set, welcome text renders in message format |
| `assistantName` | `string` | — | Name shown alongside the avatar |
| `className` | `string` | — | Additional CSS classes |

### `MessageList`

Scrollable message transcript built on a scroll engine that follows streamed output only while the reader is pinned to the live edge, and preserves the reader's position when earlier content changes height. Each direct child is wrapped in a scroll-anchored item.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | **Required.** Message elements |
| `autoScroll` | `boolean` | `true` | Follow streamed output while at the live edge (not "always jump to bottom") |
| `showScrollToBottom` | `boolean` | `true` | Render the floating scroll-to-bottom button |
| `className` | `string` | — | Classes applied to the inner transcript content container |

### `Message`

Individual message with markdown rendering, reasoning panel, citations, visualizations, media, artifacts, and interactive panels (clarification, tool approval).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `MessageData` | — | **Required.** Message data object |
| `viewerRole` | `ParticipantRole` | `"user"` | Viewer's role (determines alignment) |
| `showAvatar` | `boolean` | `true` | Show participant avatar |
| `showTimestamp` | `boolean` | `true` | Show message timestamp |
| `renderMarkdown` | `boolean` | `true` | Render content as markdown |
| `reasoning` | `StreamingChunk[]` | — | Reasoning/thinking chunks for collapsible panel |
| `reasoningExpanded` | `boolean` | — | Controlled expansion of the reasoning panel |
| `onReasoningExpandedChange` | `(expanded: boolean) => void` | — | Reasoning panel expansion callback |
| `executionPlan` | `unknown` | — | Execution plan for completed agent messages |
| `executionTimeline` | `unknown[]` | — | Execution timeline for completed messages |
| `executionTime` | `number` | — | Total execution time in seconds (persisted) |
| `streamStartedAt` | `number` | — | Epoch ms the in-progress run started, so the live elapsed counter survives remounts |
| `suggestedActions` | `SuggestedAction[]` | — | Suggested follow-up actions |
| `onSuggestedAction` | `(action: SuggestedAction) => void` | — | Suggested action click handler |
| `renderInlineSuggestedAction` | `(id: string) => ReactNode` | — | Renderer for inline `[SA:id]` markers |
| `citations` | `SourceReference[]` | — | Citation sources to display |
| `visualizations` | `VisualizationChunkData[]` | `message.visualizations` | Inline visualizations (`[VIZ:id]` markers) |
| `medias` | `MediaChunkData[]` | `message.medias` | Inline images/videos |
| `artifacts` | `ArtifactChunkData[]` | `message.artifacts` | Inline downloadable artifacts (PDF, HTML, …) |
| `onArtifactOpen` | `(artifact: ArtifactChunkData) => void` | — | Artifact inline-card click handler |
| `baselineFontSize` | `number` | — | Base font size multiplier for markdown |
| `pendingClarification` | `ClarificationData` | — | Agent needs user input |
| `onClarificationSubmit` | `(response: string) => void` | — | Clarification response handler |
| `pendingToolApproval` | `ToolApprovalData` | — | Tool awaiting approval |
| `onToolApprove` | `(modifiedInputs: Record<string, unknown>) => void` | — | Tool approval handler |
| `onToolReject` | `(reason?: string) => void` | — | Tool rejection handler |
| `onReportIncorrect` | `(reason?: string) => void` | — | Report the response as incorrect |
| `onConfirmCorrect` | `() => void` | — | Confirm the response was helpful |
| `onEditSubmit` | `(newText: string) => void` | — | Edit-and-resubmit for the viewer's own messages; enables the edit action in the hover bar |
| `className` | `string` | — | Additional CSS classes |

### `MessageComposer`

Rich text editor (Lexical) with file upload, drag-and-drop, and Enter-to-send.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSubmit` | `(content: string, attachments?: File[], attachmentIds?: string[]) => Promise<void>` | — | **Required.** Submit handler; `attachmentIds` carries server-uploaded IDs |
| `onUploadFile` | `(file: File) => Promise<string>` | — | File upload handler (returns attachment ID) |
| `onAttach` | `(files: File[]) => void` | — | Called when files are attached |
| `onRemoveUploadedAttachment` | `(attachmentId: string) => void` | — | Called when an uploaded attachment is removed pre-send |
| `disabled` | `boolean` | `false` | Disable the composer entirely |
| `supportsAttachments` | `boolean` | `true` | Enable file attachments |
| `allowedFileTypes` | `string[]` | images, docs, videos | Allowed MIME types |
| `maxFileSize` | `number` | `104857600` (100MB) | Max file size in bytes |
| `placeholder` | `string` | `"Type a message..."` | Placeholder text |
| `isSubmitting` | `boolean` | `false` | Guards the submit handshake only (loading state on send) |
| `isStreaming` | `boolean` | `false` | Per-conversation gate while a response streams: blocks Enter and swaps Send for Stop |
| `onStopStreaming` | `() => void` | — | Stop-button handler |
| `centered` | `boolean` | `false` | Welcome-screen mode: bigger radius, more padding, larger shadow |
| `commandProvider` | `CommandProvider \| null` | — | Slash-command typeahead provider |
| `commandProviders` | `CommandProvider[]` | — | Multiple trigger providers; takes precedence |
| `className` | `string` | — | Additional CSS classes |

Use `isStreaming` (not `disabled`) while a response is streaming — it keeps the composer editable, blocks submission, and shows the Stop button.

### `MessageAttachments`

Attachment strip rendered inside messages. Image attachments render as inline thumbnails that open a shared lightbox (Esc to close, arrow-key paging, body scroll-lock); non-image files render as downloadable chips. Images whose URL fails to load fall back to the file chip.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `attachments` | `Attachment[]` | — | **Required.** Attachments to display |
| `onDownload` | `(attachment: Attachment) => void` | — | Custom download handler |
| `onPreview` | `(attachment: Attachment) => void` | — | Custom preview handler |
| `align` | `"start" \| "end"` | `"start"` | Edge to align against; use `"end"` for right-aligned viewer messages |
| `className` | `string` | — | Additional CSS classes |

### `ChatHeader`

Title bar with logo, subtitle, action menu, and close button.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | — | Assistant name |
| `subtitle` | `string` | — | Description or status text |
| `logo` | `string \| ReactNode` | — | Logo URL or custom element |
| `actions` | `ChatHeaderAction[]` | — | Menu items (`{ id, label, icon?, onClick, disabled? }`) |
| `showClose` | `boolean` | — | Show close button |
| `onClose` | `() => void` | — | Close button handler |
| `loading` | `boolean` | — | Show loading skeleton |
| `className` | `string` | — | Additional CSS classes |
| `style` | `CSSProperties` | — | Inline styles |

## Styling & Theming

### CSS Import

Import the stylesheet to get default styles for all components:

```ts
import "@miiflow/assistant-ui/styles.css";
```

### Branding via CSS Variables

The `brandingCSSVars` object from `useMiiflowChat` contains CSS custom properties derived from your dashboard branding settings. Spread it onto the container element:

```tsx
<div style={brandingCSSVars}>
  <ChatLayout ... />
</div>
```

Variables emitted by `brandingCSSVars`:

| Variable | Source | Description |
|----------|--------|-------------|
| `--chat-primary` | `backgroundBubbleColor` | Primary accent color |
| `--chat-user-message-bg` | `backgroundBubbleColor` | User message bubble background |
| `--chat-user-message-text` | derived | Auto-computed contrast color for user bubbles |
| `--chat-header-bg` | `headerBackgroundColor` | Header background color |
| `--chat-message-font-size` | `messageFontSize` | Base message font size |
| `--chat-font-family` | `fontFamily` | Base font stack |
| `--chat-approval-accent` / `--chat-approval-accent-soft` | `approvalAccentColor` | Tool-approval panel accent |
| `--chat-approve-bg` / `--chat-approve-bg-hover` | `approveButtonColor` | Approve button colors |
| `--chat-reject-bg-hover` | `rejectButtonHoverColor` | Reject button hover |
| `--chat-clarification-accent` / `--chat-clarification-accent-soft` | `clarificationAccentColor` | Clarification panel accent |
| `--chat-activity` | `activityAccentColor` | In-progress indicators (falls back to `--chat-primary`) |

Beyond these, the stylesheet declares many more host-overridable `--chat-*` tokens (surfaces, borders, text, radii, composer chrome, `--chat-font-mono` for code, and more) — see `styles.css` for the full set. Set them on any ancestor element to theme the components.

### Dark surfaces

CSS variables handle colors, but some choices can't be expressed in CSS — currently the syntax-highlighting theme for code blocks. If your app renders the chat on a dark surface, pass `isDarkSurface` to `ChatProvider` (the package does not infer dark mode from the OS `prefers-color-scheme`):

```tsx
<ChatProvider isDarkSurface {...rest}>
```

### TailwindCSS Customization

All components accept a `className` prop for Tailwind utility overrides:

```tsx
<MessageComposer className="rounded-none border-0" />
```

## File Uploads

Pass `onUploadFile={uploadFile}` to `MessageComposer` to enable server-side file uploads:

```tsx
const { sendMessage, uploadFile } = useMiiflowChat(config);

<MessageComposer
  onSubmit={(content, _files, attachmentIds) => sendMessage(content, attachmentIds)}
  onUploadFile={uploadFile}
  supportsAttachments={true}
/>
```

The composer handles file picking, validation, drag-and-drop, and preview thumbnails. Files are uploaded via `uploadFile()` which returns an attachment ID; the IDs arrive as `onSubmit`'s third argument. A message with attachments and no text is valid — the composer allows attachment-only sends.

## Client-Side Tools

Register tools that the assistant can invoke on the client:

```ts
const { registerTool } = useMiiflowChat(config);

await registerTool({
  name: "get_weather",
  description: "Get current weather for a city",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name" },
    },
    required: ["city"],
  },
  handler: async (params) => {
    const response = await fetch(`/api/weather?city=${params.city}`);
    return response.json();
  },
});
```

Tools known at mount time can instead be passed via `config.tools` — they're folded into the session-init round-trip, saving a registration call. Tools are automatically re-registered when starting a new thread via `startNewThread()`.

The `handler` function receives the parameters as a `Record<string, unknown>` and must return a `Promise`. Results are sent back to the assistant automatically. A 30-second timeout is enforced per invocation. Invocations with no locally registered handler are offered to `config.onToolInvocationFallback` (useful when several widgets share one session).

## System Events

Send invisible context events that the assistant can use to inform its responses:

```ts
const { sendSystemEvent } = useMiiflowChat(config);

await sendSystemEvent({
  action: "page_navigation",
  description: "User navigated to /pricing",
  followUpInstruction: "If relevant, mention our pricing plans",
});
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `string` | Yes | Event identifier |
| `description` | `string` | Yes | Human-readable description of what happened |
| `followUpInstruction` | `string` | Yes | Instruction for the assistant |
| `metadata` | `Record<string, unknown>` | No | Additional structured data |

A system event triggers an assistant reply. To attach silent context that the assistant only uses on the *next* user message, use `sendPageContext(context)` instead — it appends hidden context to the thread without generating a response.

## Identity Verification (HMAC)

For secure identity verification, compute an HMAC on your server and pass it to the config:

```tsx
useMiiflowChat({
  publicKey: "pk_live_...",
  assistantId: "ast_...",
  userId: "user_123",
  userName: "Jane Doe",
  userEmail: "jane@example.com",
  hmac: serverComputedHmac,
  timestamp: serverTimestamp,
});
```

The `hmac` and `timestamp` should be generated server-side using your secret key. See the Miiflow dashboard for your HMAC secret.

## Visualizations

Assistant messages can contain rich visualizations (charts, tables, forms, etc.) rendered inline via `[VIZ:id]` markers. `useMiiflowChat` collects them from the stream onto `message.visualizations`, and `Message` reads them from the message when you don't pass the `visualizations` prop — so `<Message message={msg} />` renders inline charts with no extra wiring. Pass the prop explicitly only to override what the message carries (the same applies to `medias` and `artifacts`).

If a `[VIZ:id]` marker has no matching visualization, the marker is stripped rather than shown — a reader never sees a bare `[VIZ:<hex>]`. If you supply the transport yourself instead of using `useMiiflowChat`, that is what you'll get until you populate `visualizations`: read the `visualization` SSE frame (`visualization_data`) during the stream, and prefer `assistant_complete`'s `message.metadata.visualizations` once the turn ends — the server prunes renders the assistant left unembedded, so the persisted list is the authoritative one.

### Built-in Types

| Type | Component | Description |
|------|-----------|-------------|
| `chart` | `ChartVisualization` | Line, bar, pie, area, scatter charts (Recharts) |
| `table` | `TableVisualization` | Sortable, paginated data tables |
| `card` | `CardVisualization` | Structured cards with sections, actions, images |
| `kpi` | `KpiVisualization` | Key performance indicator metrics with trends |
| `code_preview` | `CodePreviewVisualization` | Syntax-highlighted code blocks |
| `form` | `FormVisualization` | Interactive forms with validation |
| `auth_prompt` | `AuthPromptVisualization` | "Connect this integration" card shown when the assistant needs an authorized provider; emits an `auth_connect` action via `onAction` (no button renders without it) |

### Visualization Registry

Instead of a hardcoded switch, visualizations are resolved through a registry. You can register custom visualization types that the `VisualizationRenderer` will render automatically:

```ts
import {
  registerVisualization,
  getVisualization,
  getRegisteredTypes,
} from "@miiflow/assistant-ui/styled";

// Register a custom visualization type
registerVisualization("my_widget", {
  component: MyWidgetComponent,
  schema: myWidgetZodSchema, // optional — enables data validation
});

// Check what's registered
console.log(getRegisteredTypes());
// ["chart", "table", "card", "kpi", "code_preview", "form", "auth_prompt", "my_widget"]
```

Your component receives these props:

```ts
interface VisualizationComponentProps {
  data: any;
  config?: VisualizationConfig;
  isStreaming?: boolean;
  onAction?: (event: VisualizationActionEvent) => void;
  medias?: MediaChunkData[]; // for resolving media_ref:<id> values
}
```

**Overriding built-ins:** Call `registerVisualization("chart", { component: MyChart })` to replace a built-in type with your own implementation. The last registration wins.

### Schema Validation

Each built-in type has a [Zod](https://zod.dev) schema registered alongside its component. When a schema is present, `VisualizationRenderer` validates the data before rendering. Invalid data shows a descriptive error fallback instead of crashing.

You can import the schemas directly for use in your own code:

```ts
import {
  chartVisualizationSchema,
  tableVisualizationSchema,
  cardVisualizationSchema,
  kpiVisualizationSchema,
  codePreviewVisualizationSchema,
  formVisualizationSchema,
  authPromptVisualizationSchema,
} from "@miiflow/assistant-ui/styled";

const result = chartVisualizationSchema.safeParse(data);
if (!result.success) {
  console.error("Invalid chart data:", result.error.issues);
}
```

To add validation to a custom type, pass a `schema` when registering:

```ts
import { z } from "zod";

const mySchema = z.object({
  message: z.string(),
  count: z.number().min(0),
});

registerVisualization("my_widget", {
  component: MyWidget,
  schema: mySchema,
});
```

**Note:** `zod` is a peer dependency (`>= 3.0.0`). Install it in your project if you haven't already.

### Interaction Callbacks

Forms, cards, and auth prompts can trigger user interactions. Instead of listening for global `CustomEvent`s, pass a callback through `ChatProvider`:

```tsx
function handleVisualizationAction(event: VisualizationActionEvent) {
  switch (event.type) {
    case "form_submit":
      console.log("Form submitted:", event.action, event.data);
      // Send the form data back to the assistant, save to DB, etc.
      break;
    case "form_cancel":
      console.log("Form cancelled:", event.action);
      break;
    case "card_action":
      console.log("Card action clicked:", event.action);
      break;
    case "auth_connect":
      // Kick off your OAuth/connect flow for event.providerName
      console.log("Connect requested:", event.providerName);
      break;
  }
}

<ChatProvider
  messages={messages}
  onSendMessage={(content) => sendMessage(content)}
  onVisualizationAction={handleVisualizationAction}
>
  ...
</ChatProvider>
```

The `VisualizationActionEvent` type is a discriminated union:

```ts
type VisualizationActionEvent =
  | { type: "form_submit"; action: string; data: Record<string, unknown> }
  | { type: "form_cancel"; action: string }
  | { type: "card_action"; action: string }
  | {
      type: "auth_connect";
      providerName: string;
      mcpServerId?: string;
      serviceProviderId?: string;
    };
```

Note the `auth_connect` variant has no `action` field — narrow on `event.type` before reading variant-specific fields.

**Backward compatibility:** If no `onVisualizationAction` callback is provided, components fall back to dispatching `CustomEvent`s on `window` (`visualization-form-submit`, `visualization-form-cancel`, `visualization-action`).

### Using `VisualizationRenderer` Standalone

You can render visualizations outside of `Message` by using `VisualizationRenderer` directly:

```tsx
import { VisualizationRenderer } from "@miiflow/assistant-ui/styled";

<VisualizationRenderer
  data={{
    id: "viz-1",
    type: "chart",
    title: "Monthly Revenue",
    data: {
      chartType: "bar",
      series: [{ name: "Revenue", data: [{ x: "Jan", y: 100 }, { x: "Feb", y: 150 }] }],
    },
  }}
  onAction={(event) => console.log(event)}
/>
```

## Package Exports

| Import | Description |
|--------|-------------|
| `@miiflow/assistant-ui` | Core types, context, hooks, primitives — plus re-exports of the styled components and shared utils (`cn`, format/color helpers, `chatTokens`) |
| `@miiflow/assistant-ui/styled` | TailwindCSS-styled components, visualization + artifact registries, schemas |
| `@miiflow/assistant-ui/client` | `useMiiflowChat` hook, session utilities, tool validation, SSE helpers, types |
| `@miiflow/assistant-ui/primitives` | Headless unstyled component primitives |
| `@miiflow/assistant-ui/composer` | Lexical composer internals: `LexicalChatInput`, command-token node/plugin/view, `CommandProvider` types |
| `@miiflow/assistant-ui/styles.css` | Full CSS (includes Tailwind preflight) |
| `@miiflow/assistant-ui/styles-no-preflight.css` | CSS without preflight (for embedding in existing pages) |

### Key Exports from `@miiflow/assistant-ui/styled`

**Visualization Registry:**
`registerVisualization`, `getVisualization`, `getRegisteredTypes`, `VisualizationEntry`

**Visualization Schemas:**
`chartVisualizationSchema`, `tableVisualizationSchema`, `cardVisualizationSchema`, `kpiVisualizationSchema`, `codePreviewVisualizationSchema`, `formVisualizationSchema`, `authPromptVisualizationSchema`

**Artifact Registry:**
`registerArtifact`, `getArtifact`, `getRegisteredArtifactTypes`, `ArtifactInlineCard`, `ArtifactList`

**Types:**
`VisualizationActionEvent`, `VisualizationChunkData`, `VisualizationConfig`, `VisualizationType`

### Key Exports from `@miiflow/assistant-ui/client`

Beyond `useMiiflowChat`: session helpers (`initSession`, `createThread`, `uploadFile`, `sendSystemEvent`, `sendPageContext`, `sendToolResult`, `getBackendBaseUrl`), tool validation (`validateToolDefinition`, `serializeToolDefinition`, `ToolValidationError`), and SSE-reducer helpers for hosts with their own stream parsing (`findToolChunkIndex`, `MatchableToolChunk`, `ToolFrame`).
