import { S as StreamingChunk } from './streaming-Dsbi9aRq.mjs';

/**
 * Core message types for the chat UI.
 */

type ParticipantRole = "user" | "assistant" | "system";
interface Participant {
    id: string;
    name?: string;
    role: ParticipantRole;
    avatarUrl?: string;
}
interface Attachment {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url?: string;
    previewUrl?: string;
    isImage?: boolean;
    isVideo?: boolean;
    isDocument?: boolean;
    humanReadableSize?: string;
    fileExtension?: string;
}
interface MessageData {
    id: string;
    textContent: string;
    participant?: Participant;
    createdAt: string | Date;
    updatedAt?: string | Date;
    attachments?: Attachment[];
    isStreaming?: boolean;
    metadata?: Record<string, unknown>;
}
interface SuggestedAction {
    id: string;
    label: string;
    value: string;
    icon?: string;
}
interface ChatMessage extends MessageData {
    suggestedActions?: SuggestedAction[];
    reasoning?: StreamingChunk[];
}
interface ReasoningChunk {
    id: string;
    type: "thinking" | "planning" | "executing" | "complete";
    content: string;
    timestamp: string | Date;
}

export type { Attachment as A, ChatMessage as C, MessageData as M, ParticipantRole as P, ReasoningChunk as R, SuggestedAction as S, Participant as a };
