import { forwardRef, useCallback, useRef, useState, useEffect } from "react";
import { ArrowUp, Paperclip, X, FileText, Image, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../utils/cn";

import { AutoLinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_STAR,
  ITALIC_UNDERSCORE,
  ORDERED_LIST,
  QUOTE,
  UNORDERED_LIST,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { QuoteNode } from "@lexical/rich-text";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  $getRoot,
  $createParagraphNode,
} from "lexical";
import type { EditorState } from "lexical";

const TRANSFORMERS = [BOLD_STAR, ITALIC_UNDERSCORE, QUOTE, ORDERED_LIST, UNORDERED_LIST];

const EDITOR_THEME = {
  ltr: "ltr",
  rtl: "rtl",
  placeholder: "editor-placeholder",
  paragraph: "editor-paragraph",
  quote: "editor-quote",
  text: {},
};

// ============================================================================
// File upload constants (matching in-house backend)
// ============================================================================

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
];
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "application/json",
  "text/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/avi",
  "video/mov",
  "video/wmv",
  "video/flv",
  "video/mkv",
];

const DEFAULT_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_VIDEO_TYPES,
];

// ============================================================================
// Attachment types
// ============================================================================

type AttachmentStatus = "pending" | "uploading" | "uploaded" | "error";

interface AttachmentFile {
  id: string;
  file: File;
  previewUrl?: string;
  status: AttachmentStatus;
  attachmentId?: string;
  error?: string;
}

// ============================================================================
// Utility
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function validateFile(
  file: File,
  allowedTypes: string[],
  maxSize: number,
): string | null {
  if (file.size > maxSize) {
    return `File size (${formatFileSize(file.size)}) exceeds max (${formatFileSize(maxSize)})`;
  }
  if (!allowedTypes.includes(file.type)) {
    return `File type ${file.type || "unknown"} is not allowed`;
  }
  return null;
}

// ============================================================================
// Sub-components
// ============================================================================

function AttachmentBar({
  attachments,
  onRemove,
  disabled,
}: {
  attachments: AttachmentFile[];
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3 pb-0">
      {attachments.map((att) => {
        const isImage = att.file.type.startsWith("image/");
        const isError = att.status === "error";
        const isUploading = att.status === "uploading";

        return (
          <div
            key={att.id}
            className={cn(
              "relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs max-w-[200px]",
              isError
                ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300",
            )}
          >
            {isUploading ? (
              <Loader2 size={14} className="flex-shrink-0 animate-spin" />
            ) : isError ? (
              <AlertCircle size={14} className="flex-shrink-0" />
            ) : isImage && att.previewUrl ? (
              <img src={att.previewUrl} alt={att.file.name} className="w-5 h-5 rounded object-cover" />
            ) : isImage ? (
              <Image size={14} className="flex-shrink-0" />
            ) : (
              <FileText size={14} className="flex-shrink-0" />
            )}
            <span className="truncate" title={isError ? att.error : att.file.name}>
              {isError ? att.error : att.file.name}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="flex-shrink-0 ml-0.5 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Lexical plugin: Enter to submit, Shift+Enter for newline.
 */
function EnterKeyPlugin({ onSubmit, disabled }: { onSubmit: () => void; disabled: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (!event) return false;
        // Shift+Enter → newline (default behavior)
        if (event.shiftKey) return false;
        // Enter → submit
        event.preventDefault();
        if (!disabled) onSubmit();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onSubmit, disabled]);

  return null;
}

/**
 * Helper plugin to clear editor content programmatically.
 */
function ClearEditorPlugin({ clearRef }: { clearRef: React.MutableRefObject<(() => void) | null> }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    clearRef.current = () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        root.append($createParagraphNode());
      });
    };
  }, [editor, clearRef]);

  return null;
}

// ============================================================================
// Main component
// ============================================================================

export interface MessageComposerProps {
  /** Callback when message is submitted */
  onSubmit: (content: string, attachments?: File[], attachmentIds?: string[]) => Promise<void>;
  /** Callback when files are attached (for upload handling) */
  onAttach?: (files: File[]) => void;
  /** Upload a file to backend, returning an attachment ID. When provided, enables server-side upload flow. */
  onUploadFile?: (file: File) => Promise<string>;
  /** Notify backend/hook that an uploaded attachment was removed before sending. */
  onRemoveUploadedAttachment?: (attachmentId: string) => void;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Whether attachments are supported */
  supportsAttachments?: boolean;
  /** Allowed MIME types for attachments (default: images + docs + videos) */
  allowedFileTypes?: string[];
  /** Maximum file size in bytes (default: 100MB) */
  maxFileSize?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether a message is currently being submitted */
  isSubmitting?: boolean;
}

/**
 * Rich text MessageComposer with Lexical editor, attachment support,
 * file upload integration, drag & drop, and Enter-to-submit.
 */
export const MessageComposer = forwardRef<HTMLDivElement, MessageComposerProps>(
  (
    {
      onSubmit,
      onAttach,
      onUploadFile,
      onRemoveUploadedAttachment,
      disabled = false,
      supportsAttachments = true,
      allowedFileTypes = DEFAULT_ALLOWED_TYPES,
      maxFileSize = MAX_FILE_SIZE,
      placeholder = "Type a message...",
      className,
      isSubmitting = false,
    },
    ref,
  ) => {
    const [inputText, setInputText] = useState("");
    const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const clearEditorRef = useRef<(() => void) | null>(null);
    const dragCounterRef = useRef(0);

    const isSubmitDisabled = disabled || isSubmitting;
    const isAnyUploading = attachments.some((a) => a.status === "uploading");
    const uploadedIds = attachments
      .filter((a) => a.status === "uploaded" && a.attachmentId)
      .map((a) => a.attachmentId!);
    const hasAttachments = uploadedIds.length > 0 || attachments.some((a) => a.status === "pending");
    const hasContent = inputText.trim().length > 0 || hasAttachments;

    const handleChange = useCallback((editorState: EditorState) => {
      editorState.read(() => {
        const value = $convertToMarkdownString(TRANSFORMERS);
        const processedValue = value
          .replace(/\n\s*\n\s*\n+/g, "\n\n")
          .replace(/(?<!\n)\n(?!\n)/g, "  \n");
        setInputText(processedValue);
      });
    }, []);

    const processFiles = useCallback(
      async (files: File[]) => {
        const newAttachments: AttachmentFile[] = files.map((file) => {
          const error = validateFile(file, allowedFileTypes, maxFileSize);
          const att: AttachmentFile = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            status: error ? "error" : onUploadFile ? "uploading" : "pending",
            error: error || undefined,
          };
          if (!error && file.type.startsWith("image/")) {
            att.previewUrl = URL.createObjectURL(file);
          }
          return att;
        });

        setAttachments((prev) => [...prev, ...newAttachments]);
        onAttach?.(files);

        // Upload files to backend if onUploadFile is provided
        if (onUploadFile) {
          for (const att of newAttachments) {
            if (att.status !== "uploading") continue;
            try {
              const attachmentId = await onUploadFile(att.file);
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === att.id
                    ? { ...a, status: "uploaded" as const, attachmentId }
                    : a,
                ),
              );
            } catch (err) {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.id === att.id
                    ? {
                        ...a,
                        status: "error" as const,
                        error: err instanceof Error ? err.message : "Upload failed",
                      }
                    : a,
                ),
              );
            }
          }
        }
      },
      [allowedFileTypes, maxFileSize, onUploadFile, onAttach],
    );

    const handleSubmit = useCallback(async () => {
      if (!hasContent || isSubmitDisabled || isAnyUploading) return;

      const text = inputText;
      const rawFiles = attachments
        .filter((a) => a.status !== "error")
        .map((a) => a.file);
      const savedAttachments = attachments;

      // Clear state immediately
      clearEditorRef.current?.();
      setInputText("");
      setAttachments([]);

      try {
        if (onUploadFile && uploadedIds.length > 0) {
          await onSubmit(text, undefined, uploadedIds);
        } else {
          await onSubmit(text, rawFiles.length > 0 ? rawFiles : undefined);
        }
      } catch {
        // Restore on error
        setInputText(text);
        setAttachments(savedAttachments);
      }
    }, [inputText, attachments, hasContent, isSubmitDisabled, isAnyUploading, onSubmit, onUploadFile, uploadedIds]);

    const handleFileSelect = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        processFiles(Array.from(files));
        // Reset so same file can be selected again
        e.target.value = "";
      },
      [processFiles],
    );

    const handleRemoveAttachment = useCallback((id: string) => {
      setAttachments((prev) => {
        const removed = prev.find((a) => a.id === id);
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        // Clean up backend-side metadata for uploaded attachments
        if (removed?.attachmentId && onRemoveUploadedAttachment) {
          onRemoveUploadedAttachment(removed.attachmentId);
        }
        return prev.filter((a) => a.id !== id);
      });
    }, [onRemoveUploadedAttachment]);

    // Drag & drop handlers
    const handleDragEnter = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!supportsAttachments || isSubmitting) return;
        dragCounterRef.current++;
        if (e.dataTransfer.types.includes("Files")) {
          setIsDragOver(true);
        }
      },
      [supportsAttachments, isSubmitting],
    );

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragOver(false);
      }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragOver(false);

        if (!supportsAttachments || isSubmitting) return;

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          processFiles(files);
        }
      },
      [supportsAttachments, isSubmitting, processFiles],
    );

    // Cleanup preview URLs on unmount
    useEffect(() => {
      return () => {
        attachments.forEach((a) => {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        });
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const initialConfig = {
      namespace: "ChatComposer",
      theme: EDITOR_THEME,
      onError(error: Error) {
        console.error("[ChatComposer]", error);
      },
      editorState() {
        return $convertFromMarkdownString("", TRANSFORMERS);
      },
      nodes: [ListItemNode, ListNode, AutoLinkNode, QuoteNode],
      editable: !isSubmitting,
    };

    return (
      <div
        ref={ref}
        className={cn(
          "sticky bottom-0 px-3 pt-2 pb-3",
          "border-t border-gray-200 dark:border-zinc-700",
          "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm",
          className,
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className={cn(
            "mx-auto max-w-[900px]",
            "rounded-xl",
            "bg-white dark:bg-zinc-800",
            "border border-gray-200 dark:border-zinc-700",
            "shadow-sm",
            "transition-all duration-200",
            "focus-within:shadow-md focus-within:border-gray-300 dark:focus-within:border-zinc-600",
            isDragOver && "ring-2 ring-blue-400 border-blue-400",
          )}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="px-3 pt-3 pb-0">
              <div className="flex items-center justify-center py-4 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-500 text-sm">
                Drop files here
              </div>
            </div>
          )}

          {/* Attachment previews */}
          <AttachmentBar attachments={attachments} onRemove={handleRemoveAttachment} disabled={isSubmitting} />

          {/* Main input row */}
          <div
            className={cn(
              "flex items-center gap-2 p-3",
              attachments.length > 0 && "pt-1.5",
            )}
          >
            {/* Paperclip button */}
            {supportsAttachments && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className={cn(
                  "flex-shrink-0",
                  "w-8 h-8 rounded-lg",
                  "flex items-center justify-center",
                  "border border-gray-200 dark:border-zinc-600",
                  "text-gray-500 dark:text-zinc-400",
                  "hover:bg-gray-50 dark:hover:bg-zinc-700",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  "transition-colors",
                )}
              >
                <Paperclip size={16} />
              </button>
            )}

            {/* Lexical editor */}
            <div className="flex-1 min-w-0">
              <LexicalComposer initialConfig={initialConfig}>
                <div className="relative px-1 text-sm">
                  <RichTextPlugin
                    contentEditable={
                      <ContentEditable
                        className={cn(
                          "outline-none resize-none",
                          "min-h-[24px] max-h-[200px] overflow-y-auto",
                          "text-gray-900 dark:text-zinc-100",
                          "[&_.editor-paragraph]:my-0",
                          "[&_.editor-quote]:ml-0 [&_.editor-quote]:pl-3 [&_.editor-quote]:border-l-4 [&_.editor-quote]:border-gray-300",
                          "[&_ul]:pl-4 [&_ol]:pl-4",
                        )}
                      />
                    }
                    placeholder={
                      <span className="absolute top-0 left-1 text-gray-400 dark:text-zinc-500 pointer-events-none select-none">
                        {placeholder}
                      </span>
                    }
                    ErrorBoundary={LexicalErrorBoundary}
                  />
                  <OnChangePlugin onChange={handleChange} />
                  <ListPlugin />
                  <HistoryPlugin />
                  <AutoFocusPlugin defaultSelection="rootStart" />
                  <EnterKeyPlugin onSubmit={handleSubmit} disabled={isSubmitDisabled || isAnyUploading} />
                  <ClearEditorPlugin clearRef={clearEditorRef} />
                </div>
              </LexicalComposer>
            </div>

            {/* Send button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasContent || isSubmitDisabled || isAnyUploading}
              className={cn(
                "flex-shrink-0",
                "w-9 h-9 rounded-lg",
                "flex items-center justify-center",
                "bg-blue-500 text-white",
                "shadow-sm",
                "hover:bg-blue-600 hover:shadow-md hover:-translate-y-px",
                "active:translate-y-0 active:shadow-sm",
                "disabled:bg-gray-300 dark:disabled:bg-zinc-600 disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed",
                "transition-all duration-200",
              )}
            >
              {isSubmitting || isAnyUploading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>

          {/* Hidden file input */}
          {supportsAttachments && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedFileTypes.join(",")}
              onChange={handleFileSelect}
              className="hidden"
            />
          )}
        </div>
      </div>
    );
  },
);

MessageComposer.displayName = "MessageComposer";

// Re-export useComposer from primitives for backwards compatibility
export { useComposer } from "../primitives";
