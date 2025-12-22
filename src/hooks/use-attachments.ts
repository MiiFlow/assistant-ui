import { useState, useCallback } from "react";

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
export function useAttachments({
  maxCount = 5,
  maxFileSize = 10 * 1024 * 1024,
  allowedTypes,
}: UseAttachmentsOptions = {}) {
  const [attachments, setAttachments] = useState<AttachmentState[]>([]);

  const addAttachment = useCallback(
    (file: File): { success: boolean; error?: string } => {
      // Check count
      if (attachments.length >= maxCount) {
        return { success: false, error: `Maximum ${maxCount} attachments allowed` };
      }

      // Check size
      if (file.size > maxFileSize) {
        return {
          success: false,
          error: `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`,
        };
      }

      // Check type
      if (allowedTypes && !allowedTypes.includes(file.type)) {
        return { success: false, error: `File type ${file.type} not allowed` };
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setAttachments((prev) => [
        ...prev,
        {
          file,
          id,
          progress: 0,
          status: "pending",
        },
      ]);

      return { success: true };
    },
    [attachments.length, maxCount, maxFileSize, allowedTypes]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, progress, status: progress < 100 ? "uploading" : "complete" }
          : a
      )
    );
  }, []);

  const setError = useCallback((id: string, error: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "error", error } : a))
    );
  }, []);

  const setUrl = useCallback((id: string, url: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, url, status: "complete", progress: 100 } : a))
    );
  }, []);

  const clear = useCallback(() => {
    setAttachments([]);
  }, []);

  const getFiles = useCallback(() => {
    return attachments.map((a) => a.file);
  }, [attachments]);

  return {
    attachments,
    addAttachment,
    removeAttachment,
    updateProgress,
    setError,
    setUrl,
    clear,
    getFiles,
    canAddMore: attachments.length < maxCount,
  };
}
