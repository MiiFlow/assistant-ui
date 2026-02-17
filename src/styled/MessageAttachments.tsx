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
    <div className={cn("flex flex-wrap gap-1.5", className)}>
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
  // Compact inline card for all attachment types
  const sizeLabel = attachment.humanReadableSize || formatFileSize(attachment.size);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg max-w-full",
        "border border-[var(--chat-border)] bg-[var(--chat-panel-bg)]",
        attachment.isImage && attachment.url && "cursor-pointer hover:bg-[var(--chat-border)]/30",
      )}
      onClick={attachment.isImage && attachment.url ? onPreview : undefined}
    >
      <FileTypeIcon mimeType={attachment.mimeType} size={14} />
      <span className="text-xs text-[var(--chat-text)] truncate min-w-0">
        {attachment.filename}
      </span>
      {sizeLabel && sizeLabel !== "0 Bytes" && (
        <span className="text-[10px] text-[var(--chat-text-subtle)] flex-shrink-0">
          {sizeLabel}
        </span>
      )}
      {attachment.url && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          className="p-0.5 hover:bg-[var(--chat-border)] rounded transition-colors flex-shrink-0"
          aria-label="Download"
        >
          <Download size={12} className="text-[var(--chat-text-subtle)]" />
        </button>
      )}
    </div>
  );
}

function FileTypeIcon({ mimeType, size = 14 }: { mimeType: string; size?: number }) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon size={size} className="text-[var(--chat-primary)] flex-shrink-0" />;
  }
  if (mimeType.startsWith("video/")) {
    return <Video size={size} className="text-[var(--chat-primary)] flex-shrink-0" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText size={size} className="text-red-500 flex-shrink-0" />;
  }
  return <FileIcon size={size} className="text-gray-500 flex-shrink-0" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
