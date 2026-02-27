# @miiflow/assistant-ui

React components and hooks for building custom Miiflow chat interfaces. Install as an npm package for full control over layout, styling, and behavior.

## Installation

```bash
npm install @miiflow/assistant-ui
```

**Peer dependencies:** `react >= 18`, `react-dom >= 18`

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
      onSendMessage={sendMessage}
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
              onSubmit={sendMessage}
              onSuggestionClick={sendMessage}
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
              onSubmit={sendMessage}
              onUploadFile={uploadFile}
              disabled={isStreaming}
              placeholder={branding?.chatboxPlaceholder}
            />
          }
        />
      </div>
    </ChatProvider>
  );
}
```

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
| `hmac` | `string` | No | HMAC for identity verification |
| `timestamp` | `string` | No | Timestamp for HMAC verification |
| `baseUrl` | `string` | No | Override API endpoint (default: `https://api.miiflow.ai/api`) |
| `webSocketUrl` | `string` | No | WebSocket URL for tool invocations (auto-derived from `baseUrl` if not set) |
| `responseTimeout` | `number` | No | SSE stream timeout in ms (default: `60000`) |

## Connecting to a Custom Backend

By default, the hook connects to `https://api.miiflow.ai`. To point to your own backend, pass a `baseUrl`:

```tsx
useMiiflowChat({
  publicKey: "pk_live_...",
  assistantId: "ast_...",
  baseUrl: "https://your-server.example.com/api",
  // webSocketUrl is auto-derived from baseUrl; override if needed:
  // webSocketUrl: "wss://your-server.example.com/ws",
});
```

Your backend must implement the same API contract as the Miiflow platform (session init, SSE streaming, file upload, and tool-result endpoints).

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
| `sendMessage` | `(content: string, attachmentIds?: string[]) => Promise<void>` | Send a message to the assistant |
| `uploadFile` | `(file: File) => Promise<string>` | Upload a file and get an attachment ID |
| `startNewThread` | `() => Promise<string>` | Start a new conversation thread |
| `registerTool` | `(tool: ClientToolDefinition) => Promise<void>` | Register a client-side tool |
| `registerTools` | `(tools: ClientToolDefinition[]) => Promise<void>` | Register multiple tools |
| `sendSystemEvent` | `(event: SystemEvent) => Promise<void>` | Send an invisible system event |

## Components Reference

### `ChatProvider`

Wraps children and provides chat context via React context.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `messages` | `ChatMessage[]` | — | Messages to display |
| `isStreaming` | `boolean` | `false` | Whether a response is streaming |
| `streamingMessageId` | `string \| null` | `null` | ID of the streaming message |
| `viewerRole` | `ParticipantRole` | `"user"` | Viewer's role (determines message alignment) |
| `onSendMessage` | `(content: string, attachments?: File[]) => Promise<void>` | — | Message send handler |
| `onStopStreaming` | `() => void` | — | Stop streaming handler |
| `onRetryLastMessage` | `() => Promise<void>` | — | Retry last message handler |
| `onVisualizationAction` | `(event: VisualizationActionEvent) => void` | — | Callback for form/card interactions |

### `ChatLayout`

Handles the empty-to-active state transition with crossfade animation. Accepts render slots for each section.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isEmpty` | `boolean` | — | Whether the chat has no messages |
| `header` | `ReactNode` | — | Header slot (rendered in both states) |
| `welcomeScreen` | `ReactNode` | — | Content for empty state |
| `messageList` | `ReactNode` | — | Message list for active state |
| `composer` | `ReactNode` | — | Composer for active state |
| `footer` | `ReactNode` | — | Extra content between list and composer |
| `variant` | `"standalone" \| "embedded" \| "widget"` | `"standalone"` | Layout variant |
| `className` | `string` | — | Additional CSS classes |

### `WelcomeScreen`

Empty state with rotating placeholder text and suggestion cards.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholders` | `string[]` | `[]` | Rotating placeholder strings |
| `suggestions` | `string[]` | `[]` | Preset suggestion cards |
| `onSubmit` | `(message: string) => void` | — | Submit handler for built-in input |
| `onSuggestionClick` | `(suggestion: string) => void` | — | Suggestion card click handler |
| `welcomeText` | `string` | `"How can I help you today?"` | Heading text |
| `composerSlot` | `ReactNode` | — | Override default input with custom composer |
| `className` | `string` | — | Additional CSS classes |

### `MessageList`

Scrollable message container with auto-scroll.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Message elements |
| `autoScroll` | `boolean` | `true` | Auto-scroll to bottom on new messages |
| `className` | `string` | — | Additional CSS classes |

### `Message`

Individual message with markdown rendering, reasoning panel, citations, and visualizations.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `MessageData` | — | Message data object |
| `viewerRole` | `ParticipantRole` | `"user"` | Viewer's role (determines alignment) |
| `showAvatar` | `boolean` | `true` | Show participant avatar |
| `showTimestamp` | `boolean` | `true` | Show message timestamp |
| `renderMarkdown` | `boolean` | `true` | Render content as markdown |
| `reasoning` | `StreamingChunk[]` | — | Reasoning/thinking chunks for collapsible panel |
| `suggestedActions` | `SuggestedAction[]` | — | Suggested follow-up actions |
| `onSuggestedAction` | `(action: SuggestedAction) => void` | — | Suggested action click handler |
| `citations` | `SourceReference[]` | — | Citation sources to display |
| `visualizations` | `VisualizationChunkData[]` | — | Inline visualizations |
| `className` | `string` | — | Additional CSS classes |

### `MessageComposer`

Rich text editor (Lexical) with file upload, drag-and-drop, and Enter-to-send.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSubmit` | `(content: string, attachments?: File[]) => Promise<void>` | — | Submit handler |
| `onUploadFile` | `(file: File) => Promise<string>` | — | File upload handler (returns attachment ID) |
| `onAttach` | `(files: File[]) => void` | — | Called when files are attached |
| `disabled` | `boolean` | `false` | Disable the composer |
| `supportsAttachments` | `boolean` | `true` | Enable file attachments |
| `allowedFileTypes` | `string[]` | images, docs, videos | Allowed MIME types |
| `maxFileSize` | `number` | `104857600` (100MB) | Max file size in bytes |
| `placeholder` | `string` | `"Type a message..."` | Placeholder text |
| `isSubmitting` | `boolean` | `false` | Show loading state on send button |
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

Available CSS variables:

| Variable | Source | Description |
|----------|--------|-------------|
| `--chat-primary` | `backgroundBubbleColor` | Primary accent color |
| `--chat-user-message-bg` | `backgroundBubbleColor` | User message bubble background |
| `--chat-header-bg` | `headerBackgroundColor` | Header background color |
| `--chat-message-font-size` | `messageFontSize` | Base message font size |

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
  onSubmit={sendMessage}
  onUploadFile={uploadFile}
  supportsAttachments={true}
/>
```

The composer handles file picking, validation, drag-and-drop, and preview thumbnails. Files are uploaded via `uploadFile()` which returns an attachment ID. The IDs are passed along when `sendMessage()` is called.

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

Tools are automatically re-registered when starting a new thread via `startNewThread()`.

The `handler` function receives the parameters as a `Record<string, unknown>` and must return a `Promise`. Results are sent back to the assistant automatically. A 30-second timeout is enforced per invocation.

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

Assistant messages can contain rich visualizations (charts, tables, forms, etc.) rendered inline via `[VIZ:id]` markers. The `Message` component handles this automatically when you pass the `visualizations` prop.

### Built-in Types

| Type | Component | Description |
|------|-----------|-------------|
| `chart` | `ChartVisualization` | Line, bar, pie, area, scatter charts (Recharts) |
| `table` | `TableVisualization` | Sortable, paginated data tables |
| `card` | `CardVisualization` | Structured cards with sections, actions, images |
| `kpi` | `KpiVisualization` | Key performance indicator metrics with trends |
| `code_preview` | `CodePreviewVisualization` | Syntax-highlighted code blocks |
| `form` | `FormVisualization` | Interactive forms with validation |

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
// ["chart", "table", "card", "kpi", "code_preview", "form", "my_widget"]
```

Your component receives these props:

```ts
interface VisualizationComponentProps {
  data: any;
  config?: VisualizationConfig;
  isStreaming?: boolean;
  onAction?: (event: VisualizationActionEvent) => void;
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

Forms and cards can trigger user interactions (submit, cancel, button click). Instead of listening for global `CustomEvent`s, pass a callback through `ChatProvider`:

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
  }
}

<ChatProvider
  messages={messages}
  onSendMessage={sendMessage}
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
  | { type: "card_action"; action: string };
```

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
| `@miiflow/assistant-ui` | Core types, context, hooks, primitives |
| `@miiflow/assistant-ui/styled` | TailwindCSS-styled components, visualization registry, schemas |
| `@miiflow/assistant-ui/client` | `useMiiflowChat` hook, session utilities, types |
| `@miiflow/assistant-ui/primitives` | Headless unstyled component primitives |
| `@miiflow/assistant-ui/styles.css` | Full CSS (includes Tailwind preflight) |
| `@miiflow/assistant-ui/styles-no-preflight.css` | CSS without preflight (for embedding in existing pages) |

### Key Exports from `@miiflow/assistant-ui/styled`

**Visualization Registry:**
`registerVisualization`, `getVisualization`, `getRegisteredTypes`, `VisualizationEntry`

**Visualization Schemas:**
`chartVisualizationSchema`, `tableVisualizationSchema`, `cardVisualizationSchema`, `kpiVisualizationSchema`, `codePreviewVisualizationSchema`, `formVisualizationSchema`

**Types:**
`VisualizationActionEvent`, `VisualizationChunkData`, `VisualizationConfig`, `VisualizationType`
