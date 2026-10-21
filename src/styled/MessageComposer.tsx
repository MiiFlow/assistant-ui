import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  type Ref,
} from "react";
import {
  ArrowUp,
  X,
  FileText,
  Image,
  Loader2,
  AlertCircle,
  Square,
} from "lucide-react";
import { cn } from "../utils/cn";
import {
  LexicalChatInput,
  type CommandProvider,
  type LexicalChatInputHandle,
  type ChatComposerToken,
} from "../composer";
import { ComposerToolbar } from "./ComposerToolbar";
import { QueuedMessages, type QueuedComposerMessage } from "./QueuedMessages";

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
  "text/csv",
  "text/xml",
  "application/xml",
  "text/markdown",
  "application/json",
  "text/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  // Browsers report the registered names (a .mov is video/quicktime, .avi
  // video/x-msvideo, .wmv video/x-ms-wmv, .mkv video/x-matroska, .flv
  // video/x-flv); the short names are not registered, so listing only them
  // rejected every such upload. Some platforms still report video/avi.
  "video/quicktime",
  "video/x-msvideo",
  "video/x-ms-wmv",
  "video/x-matroska",
  "video/x-flv",
  "video/avi",
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
  /** Share of the upload sent so far (0–1); absent when the host reports none. */
  uploadedFraction?: number;
}

/** A file the host already uploaded, with the id the server gave it. */
export interface UploadedComposerAttachment {
  file: File;
  attachmentId: string;
}

export interface UploadFileOptions {
  /**
   * Called as the body goes out. Only `loaded / total` is used: the request is
   * not the file (a host may compress it, and the multipart envelope adds bytes).
   */
  onProgress?: (loaded: number, total: number) => void;
  /** Aborted when the person removes the file or the composer unmounts. */
  signal?: AbortSignal;
}

// ============================================================================
// Utility
// ============================================================================

function newAttachmentId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function previewUrlFor(file: File): string | undefined {
  return file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
}

function revokePreviews(attachments: AttachmentFile[]) {
  for (const a of attachments) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
}

const MB = 1024 * 1024;

/** "12 / 33 MB", "0.4 / 1.5 MB" under 10 MB, "45%" under 1 MB. */
function formatUploadProgress(fraction: number, size: number): string {
  if (size < MB) return `${Math.floor(100 * fraction)}%`;
  const digits = size < 10 * MB ? 1 : 0;
  const mb = (bytes: number) => (bytes / MB).toFixed(digits);
  // Floor the part sent so it never reads as done before it is.
  const sent = Math.floor((fraction * size) / MB * 10 ** digits) / 10 ** digits;
  return `${sent.toFixed(digits)} / ${mb(size)} MB`;
}

function ProgressRing({ fraction }: { fraction: number }) {
  const radius = 5.5;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" className="flex-shrink-0 -rotate-90" aria-hidden>
      <circle cx={7} cy={7} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
      <circle
        cx={7}
        cy={7}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        className="transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  );
}

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
  // An empty file has nothing to send; a clipboard can hand over one (an
  // "image.png" of 0 bytes), and uploading it only tells the reader later.
  if (file.size === 0) {
    return "File is empty. Copy or export it again.";
  }
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
        const fraction = isUploading ? att.uploadedFraction : undefined;

        return (
          <div
            key={att.id}
            className={cn(
              "relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs",
              isUploading ? "max-w-[280px]" : "max-w-[200px]",
              isError
                ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300",
            )}
            {...(isUploading && {
              role: "progressbar",
              "aria-label": `Uploading ${att.file.name}`,
              "aria-valuemin": 0,
              "aria-valuemax": 100,
              ...(fraction !== undefined && {
                "aria-valuenow": Math.floor(100 * fraction),
              }),
            })}
          >
            {fraction !== undefined ? (
              <ProgressRing fraction={fraction} />
            ) : isUploading ? (
              <Loader2 size={14} className="flex-shrink-0 animate-spin" />
            ) : isError ? (
              <AlertCircle size={14} className="flex-shrink-0" />
            ) : isImage && att.previewUrl ? (
              <img
                src={att.previewUrl}
                alt={att.file.name}
                className="w-5 h-5 rounded object-cover"
              />
            ) : isImage ? (
              <Image size={14} className="flex-shrink-0" />
            ) : (
              <FileText size={14} className="flex-shrink-0" />
            )}
            <span
              className="truncate"
              title={isError ? att.error : att.file.name}
            >
              {isError ? att.error : att.file.name}
            </span>
            {isUploading && (
              <span className="flex-shrink-0 tabular-nums opacity-70">
                {fraction !== undefined
                  ? formatUploadProgress(fraction, att.file.size)
                  : "Uploading…"}
              </span>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                aria-label={`Remove ${att.file.name}`}
                className="chat-composer-remove flex-shrink-0 ml-0.5 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
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

// ============================================================================
// Main component
// ============================================================================

export type MessageComposerHandle = Pick<
  LexicalChatInputHandle,
  "appendText" | "focus"
>;

/**
 * Messages sent while a turn is running wait in a queue the host owns. With
 * this set, sending during a turn goes through `onSubmit` (the host queues it)
 * instead of being blocked.
 */
export interface MessageComposerQueue {
  messages: QueuedComposerMessage[];
  /** Stop the turn in progress and send this message in its place. */
  onSteer: (id: string) => void;
  onRemove: (id: string) => void;
  /** Remove the message from the queue and hand back what to put in the
   *  composer for editing. */
  onTakeForEdit?: (
    id: string,
  ) =>
    | {
        text: string;
        attachments?: File[];
        uploadedAttachments?: UploadedComposerAttachment[];
      }
    | undefined;
}

export interface MessageComposerProps {
  /** Draft actions for host starter cards; the forwarded ref remains the root DOM element. */
  composerRef?: Ref<MessageComposerHandle>;
  /** Callback when message is submitted */
  /**
   * Resolves once the message is ACCEPTED. A host that rejects the send (an
   * upload that failed, a suspended org, a run already in progress) resolves
   * `{ accepted: false }` so the composer can hand the draft back instead of
   * swallowing it (BUG-069).
   */
  onSubmit: (
    content: string,
    attachments?: File[],
    attachmentIds?: string[],
    /** The files behind `attachmentIds`, in order, for the host's sent bubble. */
    uploadedAttachments?: UploadedComposerAttachment[],
  ) => Promise<void | { accepted?: boolean }>;
  /** Callback when files are attached (for upload handling) */
  onAttach?: (files: File[]) => void;
  /**
   * Upload a file to backend, returning an attachment ID. When provided, files
   * upload as soon as they are attached, and a send pressed during an upload
   * goes out when it finishes. Rejects with an Error whose message is shown on
   * the file. Report `onProgress` to show how far along the upload is.
   */
  onUploadFile?: (file: File, options?: UploadFileOptions) => Promise<string>;
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
  /** Centered/welcome mode: the host owns the outer spacing. */
  centered?: boolean;
  /** Whether assistant is currently streaming a response */
  isStreaming?: boolean;
  /** Callback to stop the current streaming response */
  onStopStreaming?: () => void;
  /** Queue for messages sent during a turn; see MessageComposerQueue. */
  queue?: MessageComposerQueue;
  /** Optional slash-command typeahead provider (e.g. for skill picker). */
  commandProvider?: CommandProvider | null;
  /** Multiple typeahead providers for distinct triggers (e.g. `/` skills +
   *  modes plus `@` ad accounts). Takes precedence over `commandProvider`. */
  commandProviders?: CommandProvider[];
}

/**
 * MessageComposer with textarea, attachment support,
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
      centered = false,
      isStreaming = false,
      onStopStreaming,
      queue,
      commandProvider,
      commandProviders,
      composerRef,
    },
    ref,
  ) => {
    const [hasText, setHasText] = useState(false);
    const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    // A send pressed while files were still uploading: its text and the
    // uploads it waits for. It goes out when they finish; the draft stays
    // locked until then.
    const [pendingSend, setPendingSend] = useState<{
      text: string;
      waitingOn: string[];
    } | null>(null);
    const isSendPending = pendingSend !== null;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<LexicalChatInputHandle>(null);
    const tokenLabels = useRef(new Map<string, string>());
    const resolveTokenLabel = useCallback(
      (id: string, kind: string) => tokenLabels.current.get(`${kind}:${id}`),
      [],
    );
    const handleChange = useCallback(
      ({ text, tokens }: { text: string; tokens: ChatComposerToken[] }) => {
        for (const token of tokens)
          tokenLabels.current.set(`${token.kind}:${token.id}`, token.label);
        setHasText(text.trim().length > 0);
      },
      [],
    );
    const dragCounterRef = useRef(0);
    const isSubmittingRef = useRef(false);
    // A running turn blocks sending only when the host has no queue to put
    // the message in: a second concurrent turn on one conversation is invalid.
    const sendBlockedByTurn = isStreaming && !queue;

    useImperativeHandle(
      composerRef,
      () => ({
        appendText: (text) => {
          if (
            !disabled &&
            !isSubmitting &&
            !isSubmittingRef.current &&
            !sendBlockedByTurn &&
            !isSendPending
          )
            inputRef.current?.appendText(text);
        },
        focus: () => inputRef.current?.focus(),
      }),
      [disabled, isSubmitting, sendBlockedByTurn, isSendPending],
    );

    const providers = commandProviders?.length
      ? commandProviders
      : commandProvider
        ? [commandProvider]
        : [];

    const isSubmitDisabled = disabled || isSubmitting;
    const isAnyUploading = attachments.some((a) => a.status === "uploading");
    const uploaded = attachments.filter(
      (a): a is AttachmentFile & { attachmentId: string } =>
        a.status === "uploaded" && !!a.attachmentId,
    );
    const uploadedIds = uploaded.map((a) => a.attachmentId);
    const hasAttachments = attachments.some((a) => a.status !== "error");
    const hasContent = hasText || hasAttachments;

    // One controller per upload in flight, so removing a file (or leaving)
    // stops sending its bytes instead of finishing an upload nobody will use.
    const uploadAbortersRef = useRef(new Map<string, AbortController>());

    const updateAttachment = useCallback(
      (id: string, patch: Partial<AttachmentFile>) =>
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        ),
      [],
    );

    const uploadAttachment = useCallback(
      async (att: AttachmentFile, upload: NonNullable<typeof onUploadFile>) => {
        const controller = new AbortController();
        uploadAbortersRef.current.set(att.id, controller);
        let reportedPercent = -1;
        try {
          const attachmentId = await upload(att.file, {
            signal: controller.signal,
            onProgress: (loaded, total) => {
              // Progress events fire many times a second; re-render only when
              // the visible figure can change.
              const fraction = total > 0 ? Math.min(loaded / total, 1) : 0;
              const percent = Math.floor(100 * fraction);
              if (percent === reportedPercent) return;
              reportedPercent = percent;
              updateAttachment(att.id, { uploadedFraction: fraction });
            },
          });
          updateAttachment(att.id, {
            status: "uploaded",
            attachmentId,
            uploadedFraction: undefined,
          });
        } catch (err) {
          // Removed by the person: the attachment is already gone.
          if (controller.signal.aborted) return;
          updateAttachment(att.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
            uploadedFraction: undefined,
          });
        } finally {
          uploadAbortersRef.current.delete(att.id);
        }
      },
      [updateAttachment],
    );

    const processFiles = useCallback(
      (files: File[]) => {
        const newAttachments: AttachmentFile[] = files.map((file) => {
          const error = validateFile(file, allowedFileTypes, maxFileSize);
          return {
            id: newAttachmentId(),
            file,
            status: error ? "error" : onUploadFile ? "uploading" : "pending",
            error: error || undefined,
            previewUrl: error ? undefined : previewUrlFor(file),
          };
        });

        setAttachments((prev) => [...prev, ...newAttachments]);
        onAttach?.(files);

        // Upload to the backend now, in parallel, while the person types.
        if (onUploadFile) {
          for (const att of newAttachments) {
            if (att.status === "uploading")
              void uploadAttachment(att, onUploadFile);
          }
        }
      },
      [allowedFileTypes, maxFileSize, onUploadFile, onAttach, uploadAttachment],
    );

    const takeQueuedForEdit = queue?.onTakeForEdit;
    const handleEditQueued = useCallback(
      (id: string) => {
        const taken = takeQueuedForEdit?.(id);
        if (!taken) return;
        inputRef.current?.setContent(taken.text);
        setHasText(taken.text.trim().length > 0);
        if (taken.attachments?.length) processFiles(taken.attachments);
        // Already on the server: back in the composer as uploaded, not again.
        const restored = taken.uploadedAttachments ?? [];
        if (restored.length)
          setAttachments((prev) => [
            ...prev,
            ...restored.map(({ file, attachmentId }) => ({
              id: newAttachmentId(),
              file,
              status: "uploaded" as const,
              attachmentId,
              previewUrl: previewUrlFor(file),
            })),
          ]);
        inputRef.current?.focus();
      },
      [takeQueuedForEdit, processFiles],
    );

    const submitWithText = useCallback(
      async (text: string) => {
        if (!hasContent && text.trim().length === 0) return;
        // The per-conversation gate: the send button is already swapped for
        // Stop while a turn is running, but Enter bypasses the button. With a
        // queue the host takes the message and sends it after the turn.
        if (sendBlockedByTurn) return;
        // Pressed before an upload finished: the send waits for it (see the
        // effect below) instead of being dropped without a word.
        if (isAnyUploading) {
          if (!isSubmitDisabled)
            setPendingSend({
              text,
              waitingOn: attachments
                .filter((a) => a.status === "uploading")
                .map((a) => a.id),
            });
          return;
        }
        // `isSubmittingRef` guards only the handshake (double Enter / double
        // click). `onSubmit` must resolve once the message is accepted — if a
        // host holds it open for the whole response, this latch becomes a lock
        // on every conversation the composer is reused for.
        if (isSubmitDisabled || isSubmittingRef.current) return;
        isSubmittingRef.current = true;

        const rawFiles = attachments
          .filter((a) => a.status !== "error")
          .map((a) => a.file);
        const savedAttachments = attachments;

        inputRef.current?.clear();
        setHasText(false);
        setAttachments([]);

        const restoreDraft = () => {
          inputRef.current?.setContent(text);
          setHasText(text.trim().length > 0);
          setAttachments(savedAttachments);
        };

        try {
          const result =
            onUploadFile && uploadedIds.length > 0
              ? await onSubmit(
                  text,
                  undefined,
                  uploadedIds,
                  uploaded.map(({ file, attachmentId }) => ({
                    file,
                    attachmentId,
                  })),
                )
              : await onSubmit(
                  text,
                  rawFiles.length > 0 ? rawFiles : undefined,
                );
          // A rejected send resolves rather than throwing, so without this the
          // text and files were cleared for a message that never went.
          if (result && result.accepted === false) {
            restoreDraft();
          } else {
            // Sent: the host renders its own previews from the files.
            revokePreviews(savedAttachments);
          }
        } catch {
          restoreDraft();
        } finally {
          isSubmittingRef.current = false;
        }
      },
      [
        attachments,
        hasContent,
        isSubmitDisabled,
        isAnyUploading,
        sendBlockedByTurn,
        onSubmit,
        onUploadFile,
        uploaded,
        uploadedIds,
      ],
    );

    // The waiting send goes out once the last upload settles. If one it was
    // waiting for failed, it stays a draft: the person pressed Send expecting
    // that file to go, and sending without it would misreport what the
    // assistant can see. A chip already red at Send was seen and sent past,
    // as a send without a wait would.
    useEffect(() => {
      if (pendingSend === null || isAnyUploading) return;
      setPendingSend(null);
      const failed = attachments.some(
        (a) => a.status === "error" && pendingSend.waitingOn.includes(a.id),
      );
      if (!failed) void submitWithText(pendingSend.text);
    }, [pendingSend, isAnyUploading, attachments, submitWithText]);

    const handleSendButtonClick = useCallback(() => {
      // While a send waits on an upload, the button calls it off.
      if (isSendPending) {
        setPendingSend(null);
        return;
      }
      inputRef.current?.submit();
    }, [isSendPending]);

    const handleFileSelect = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || isSendPending) return;
        processFiles(Array.from(files));
        // Reset so same file can be selected again
        e.target.value = "";
      },
      [processFiles, isSendPending],
    );

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        if (!supportsAttachments || isSubmitting || isSendPending) return;
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        // Collect files from clipboard
        const files: File[] = [];
        for (const file of clipboardData.files) {
          files.push(file);
        }
        // Fallback: check items for image data (e.g. screenshots, images from web pages)
        if (files.length === 0 && clipboardData.items) {
          for (const item of clipboardData.items) {
            if (item.kind === "file") {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
        }

        if (files.length > 0) {
          e.preventDefault();
          processFiles(files);
        }
      },
      [supportsAttachments, isSubmitting, isSendPending, processFiles],
    );

    const handleRemoveAttachment = useCallback(
      (id: string) => {
        uploadAbortersRef.current.get(id)?.abort();
        // A waiting send that included this file is a new draft without it;
        // removing a chip it was not waiting for changes nothing it carries.
        setPendingSend((pending) =>
          pending?.waitingOn.includes(id) ? null : pending,
        );
        setAttachments((prev) => {
          const removed = prev.find((a) => a.id === id);
          if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
          // Clean up backend-side metadata for uploaded attachments
          if (removed?.attachmentId && onRemoveUploadedAttachment) {
            onRemoveUploadedAttachment(removed.attachmentId);
          }
          return prev.filter((a) => a.id !== id);
        });
      },
      [onRemoveUploadedAttachment],
    );

    // Drag & drop handlers
    const handleDragEnter = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!supportsAttachments || isSubmitting || isSendPending) return;
        dragCounterRef.current++;
        if (e.dataTransfer.types.includes("Files")) {
          setIsDragOver(true);
        }
      },
      [supportsAttachments, isSubmitting, isSendPending],
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

        if (!supportsAttachments || isSubmitting || isSendPending) return;

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          processFiles(files);
        }
      },
      [supportsAttachments, isSubmitting, isSendPending, processFiles],
    );

    // On unmount, release the previews of whatever is attached THEN (not at
    // the first render) and stop uploads in flight.
    const attachmentsRef = useRef(attachments);
    attachmentsRef.current = attachments;
    useEffect(() => {
      const aborters = uploadAbortersRef.current;
      return () => {
        revokePreviews(attachmentsRef.current);
        aborters.forEach((controller) => controller.abort());
      };
    }, []);

    return (
      <div
        ref={ref}
        className={cn(
          "chat-message-composer flex-shrink-0",
          centered ? "p-0 bg-transparent" : "px-3 pb-3",
          className,
        )}
        style={
          centered
            ? { padding: 0, background: "transparent", border: "none" }
            : undefined
        }
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {queue && queue.messages.length > 0 && (
          <div className="mx-auto max-w-[900px]">
            <QueuedMessages
              messages={queue.messages}
              onSteer={queue.onSteer}
              onRemove={queue.onRemove}
              onEdit={takeQueuedForEdit ? handleEditQueued : undefined}
              isStreaming={isStreaming}
              canEdit={!hasContent}
            />
          </div>
        )}
        <div
          className={cn(
            "mx-auto max-w-[900px]",
            "chat-composer-shell group",
            centered && "overflow-hidden",
            isDragOver &&
              "ring-2 ring-[var(--chat-primary,#106997)] border-[var(--chat-primary,#106997)]",
          )}
          style={centered ? { overflow: "hidden" } : undefined}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="px-3 pt-3 pb-0">
              <div className="flex items-center justify-center py-4 rounded-lg border-2 border-dashed border-[var(--chat-composer-border-focus,rgba(16,105,151,0.35))] bg-[var(--chat-panel-bg,rgba(0,0,0,0.02))] text-[var(--chat-primary,#106997)] text-sm">
                Drop files here
              </div>
            </div>
          )}

          {/* Attachment previews */}
          <AttachmentBar
            attachments={attachments}
            onRemove={handleRemoveAttachment}
            disabled={isSubmitting}
          />

          {/* Text row */}
          <div
            className={cn("px-4 pt-3.5", attachments.length > 0 && "pt-1.5")}
            onPaste={handlePaste}
          >
            <LexicalChatInput
              ref={inputRef}
              placeholder={placeholder}
              placeholderClassName="!text-[var(--chat-placeholder)]"
              disabled={isSubmitDisabled || isSendPending}
              commandProvider={commandProvider ?? null}
              commandProviders={commandProviders}
              inputClassName={cn(
                "leading-relaxed",
                "text-gray-900 dark:text-zinc-100",
                "placeholder:text-gray-400 dark:placeholder:text-zinc-500",
              )}
              onChange={handleChange}
              resolveTokenLabel={resolveTokenLabel}
              onSubmit={({ text }) => submitWithText(text)}
            />
          </div>

          {/* Toolbar row */}
          <ComposerToolbar
            className="px-2.5 pb-2.5 pt-2"
            onAttachClick={
              supportsAttachments
                ? () => fileInputRef.current?.click()
                : undefined
            }
            onContextClick={
              providers.some((provider) => provider.trigger === "@")
                ? () => inputRef.current?.insertTrigger("@")
                : undefined
            }
            onSkillsClick={
              providers.some((provider) => (provider.trigger ?? "/") === "/")
                ? () => inputRef.current?.insertTrigger("/")
                : undefined
            }
            disabled={isSubmitDisabled || isSendPending}
            endSlot={
              // With a queue, a draft during a turn shows Send (it queues);
              // Stop comes back once the draft is empty.
              isStreaming && onStopStreaming && !(queue && hasContent) ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  aria-label="Stop generating"
                  className="chat-composer-action"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : isSendPending ? (
                <>
                  <span
                    className="text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap"
                    aria-live="polite"
                  >
                    Sends when uploaded
                  </span>
                  <button
                    type="button"
                    onClick={handleSendButtonClick}
                    aria-label="Cancel send"
                    title="Cancel send"
                    className="chat-composer-action group/pending"
                  >
                    <Loader2
                      size={16}
                      className="animate-spin group-hover/pending:hidden"
                    />
                    <X size={16} className="hidden group-hover/pending:block" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSendButtonClick}
                  // `isStreaming` matters here only for hosts that pass it
                  // without `onStopStreaming` (no Stop button to swap in) —
                  // without it the button would look live but silently no-op.
                  // An upload in progress does not disable it: the send waits.
                  disabled={!hasContent || isSubmitDisabled || sendBlockedByTurn}
                  aria-label={isStreaming ? "Queue message" : "Send message"}
                  className="chat-composer-action"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowUp size={16} />
                  )}
                </button>
              )
            }
          />

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
