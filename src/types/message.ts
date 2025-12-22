/**
 * Core message types for the chat UI.
 */

import type { StreamingChunk } from "./streaming";

export type ParticipantRole = "user" | "assistant" | "system";

export interface Participant {
  id: string;
  name?: string;
  role: ParticipantRole;
  avatarUrl?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  previewUrl?: string;
  // Extended fields for main app compatibility
  isImage?: boolean;
  isVideo?: boolean;
  isDocument?: boolean;
  humanReadableSize?: string;
  fileExtension?: string;
}

export interface MessageData {
  id: string;
  textContent: string;
  participant?: Participant;
  createdAt: string | Date;
  updatedAt?: string | Date;
  attachments?: Attachment[];
  isStreaming?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SuggestedAction {
  id: string;
  label: string;
  value: string;
  icon?: string;
}

export interface ChatMessage extends MessageData {
  suggestedActions?: SuggestedAction[];
  reasoning?: StreamingChunk[];
}

// Legacy type - kept for backwards compatibility
export interface ReasoningChunk {
  id: string;
  type: "thinking" | "planning" | "executing" | "complete";
  content: string;
  timestamp: string | Date;
}
