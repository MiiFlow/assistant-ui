import { useState } from "react";
import { Download, FileIcon, FileText, Image as ImageIcon, Video, X } from "lucide-react";
import { cn } from "../utils/cn";
import type { Attachment } from "../types";

export interface MessageAttachmentsProps {
  /** List of attachments to display */
  attachments: Attachment[];
  /** Custom download handler */
  onDownload?: (attachment: Attachment) => void;
  /** Custom preview handler */
  onPreview?: (attachment: Attachment) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Display attachments (images, videos, documents) in messages
 */
export function MessageAttachments({
  attachments,
  onDownload,
  onPreview,
  className,
}: MessageAttachmentsProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const handleDownload = (attachment: Attachment) => {
    if (onDownload) {
      onDownload(attachment);
      return;
    }

    // Default download behavior
    if (attachment.url) {
      const link = document.createElement("a");
      link.href = attachment.url;
      link.download = attachment.filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePreview = (attachment: Attachment) => {
    if (onPreview) {
      onPreview(attachment);
      return;
    }

    // Default preview for images
    if (attachment.isImage && attachment.url) {
      setLightboxUrl(attachment.url);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {attachments.map((attachment) => (
        <AttachmentCard
          key={attachment.id}
          attachment={attachment}
          onDownload={() => handleDownload(attachment)}
          onPreview={() => handlePreview(attachment)}
        />
      ))}

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function AttachmentCard({
  attachment,
  onDownload,
  onPreview,
}: {
  attachment: Attachment;
  onDownload: () => void;
  onPreview: () => void;
}) {
  // Image attachment
  if (attachment.isImage && attachment.url) {
    return (
      <div className="rounded-lg border border-[var(--chat-border)] overflow-hidden">
        <div
          className="relative h-48 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onPreview}
        >
          <img
            src={attachment.previewUrl || attachment.url}
            alt={attachment.filename}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--chat-panel-bg)]">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon size={16} className="text-[var(--chat-primary)] flex-shrink-0" />
            <span className="text-sm text-[var(--chat-text)] truncate">
              {attachment.filename}
            </span>
          </div>
          <button
            onClick={onDownload}
            className="p-1.5 hover:bg-[var(--chat-border)] rounded transition-colors flex-shrink-0"
            aria-label="Download"
          >
            <Download size={16} className="text-[var(--chat-text-subtle)]" />
          </button>
        </div>
      </div>
    );
  }

  // Video attachment
  if (attachment.isVideo && attachment.url) {
    return (
      <div className="rounded-lg border border-[var(--chat-border)] overflow-hidden">
        <video
          src={attachment.url}
          controls
          className="w-full h-48 object-cover"
        />
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--chat-panel-bg)]">
          <div className="flex items-center gap-2 min-w-0">
            <Video size={16} className="text-[var(--chat-primary)] flex-shrink-0" />
            <span className="text-sm text-[var(--chat-text)] truncate">
              {attachment.filename}
            </span>
          </div>
          <button
            onClick={onDownload}
            className="p-1.5 hover:bg-[var(--chat-border)] rounded transition-colors flex-shrink-0"
            aria-label="Download"
          >
            <Download size={16} className="text-[var(--chat-text-subtle)]" />
          </button>
        </div>
      </div>
    );
  }

  // Document/file attachment
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--chat-border)] bg-[var(--chat-panel-bg)]">
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
        <FileTypeIcon mimeType={attachment.mimeType} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--chat-text)] truncate">
          {attachment.filename}
        </p>
        <p className="text-xs text-[var(--chat-text-subtle)]">
          {attachment.humanReadableSize || formatFileSize(attachment.size)}
        </p>
      </div>
      <button
        onClick={onDownload}
        className="p-2 hover:bg-[var(--chat-border)] rounded-lg transition-colors flex-shrink-0"
        aria-label="Download"
      >
        <Download size={18} className="text-[var(--chat-text-subtle)]" />
      </button>
    </div>
  );
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon size={20} className="text-[var(--chat-primary)]" />;
  }
  if (mimeType.startsWith("video/")) {
    return <Video size={20} className="text-[var(--chat-primary)]" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText size={20} className="text-red-500" />;
  }
  return <FileIcon size={20} className="text-gray-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
