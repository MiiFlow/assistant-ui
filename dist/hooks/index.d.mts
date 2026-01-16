import * as react from 'react';
import { KeyboardEvent } from 'react';
import { c as StreamingOptions, b as StreamChunk } from '../streaming-beXFE8Rc.mjs';

interface UseAutoScrollOptions {
    /** Whether auto-scroll is enabled */
    enabled?: boolean;
    /** Threshold from bottom to trigger auto-scroll (pixels) */
    threshold?: number;
    /** Smooth scroll behavior */
    smooth?: boolean;
}
/**
 * Hook to automatically scroll to the bottom of a container
 * when new content is added, unless the user has scrolled up.
 */
declare function useAutoScroll<T extends HTMLElement>({ enabled, threshold, smooth, }?: UseAutoScrollOptions): {
    containerRef: react.RefObject<T | null>;
    scrollToBottom: (force?: boolean) => void;
    isAtBottom: boolean;
};

/**
 * Hook to manage streaming message state.
 */
declare function useStreaming(options?: StreamingOptions): {
    startStreaming: (messageId: string) => void;
    appendContent: (chunk: StreamChunk) => void;
    stopStreaming: () => void;
    handleError: (error: Error) => void;
    abortSignal: AbortSignal | undefined;
    isStreaming: boolean;
    streamingMessageId: string | null;
    streamedContent: string;
};

interface UseMessageComposerOptions {
    /** Callback when message is submitted */
    onSubmit: (content: string, attachments?: File[]) => Promise<void>;
    /** Whether submission is disabled */
    disabled?: boolean;
    /** Maximum file size in bytes */
    maxFileSize?: number;
    /** Allowed file types (MIME types) */
    allowedFileTypes?: string[];
}
/**
 * Hook to manage message composer state and behavior.
 */
declare function useMessageComposer({ onSubmit, disabled, maxFileSize, // 10MB
allowedFileTypes, }: UseMessageComposerOptions): {
    content: string;
    attachments: File[];
    isSubmitting: boolean;
    error: string | null;
    canSubmit: boolean | "";
    inputRef: react.RefObject<HTMLTextAreaElement | null>;
    handleContentChange: (value: string) => void;
    handleAddAttachment: (files: FileList | File[]) => void;
    handleRemoveAttachment: (index: number) => void;
    handleSubmit: () => Promise<void>;
    handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    clear: () => void;
};

interface AttachmentState {
    file: File;
    id: string;
    progress: number;
    status: "pending" | "uploading" | "complete" | "error";
    error?: string;
    url?: string;
}
interface UseAttachmentsOptions {
    /** Maximum number of attachments */
    maxCount?: number;
    /** Maximum file size in bytes */
    maxFileSize?: number;
    /** Allowed MIME types */
    allowedTypes?: string[];
}
/**
 * Hook to manage file attachments with upload progress.
 */
declare function useAttachments({ maxCount, maxFileSize, allowedTypes, }?: UseAttachmentsOptions): {
    attachments: AttachmentState[];
    addAttachment: (file: File) => {
        success: boolean;
        error?: string;
    };
    removeAttachment: (id: string) => void;
    updateProgress: (id: string, progress: number) => void;
    setError: (id: string, error: string) => void;
    setUrl: (id: string, url: string) => void;
    clear: () => void;
    getFiles: () => File[];
    canAddMore: boolean;
};

export { useAttachments, useAutoScroll, useMessageComposer, useStreaming };
