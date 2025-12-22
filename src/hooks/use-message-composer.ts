import { useState, useCallback, useRef, type KeyboardEvent } from "react";

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
export function useMessageComposer({
  onSubmit,
  disabled = false,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedFileTypes,
}: UseMessageComposerOptions) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    setError(null);
  }, []);

  const handleAddAttachment = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validFiles: File[] = [];

      for (const file of fileArray) {
        // Check file size
        if (file.size > maxFileSize) {
          setError(`File "${file.name}" exceeds maximum size`);
          continue;
        }

        // Check file type
        if (allowedFileTypes && !allowedFileTypes.includes(file.type)) {
          setError(`File type "${file.type}" is not allowed`);
          continue;
        }

        validFiles.push(file);
      }

      setAttachments((prev) => [...prev, ...validFiles]);
    },
    [maxFileSize, allowedFileTypes]
  );

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedContent = content.trim();
    if ((!trimmedContent && attachments.length === 0) || disabled || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmedContent, attachments.length > 0 ? attachments : undefined);
      setContent("");
      setAttachments([]);
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  }, [content, attachments, disabled, isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter without Shift
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const clear = useCallback(() => {
    setContent("");
    setAttachments([]);
    setError(null);
  }, []);

  const canSubmit = (content.trim() || attachments.length > 0) && !disabled && !isSubmitting;

  return {
    content,
    attachments,
    isSubmitting,
    error,
    canSubmit,
    inputRef,
    handleContentChange,
    handleAddAttachment,
    handleRemoveAttachment,
    handleSubmit,
    handleKeyDown,
    clear,
  };
}
