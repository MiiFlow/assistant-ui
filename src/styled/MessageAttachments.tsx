import { useMemo, useState } from "react";
import { Download, FileIcon, FileText, Image as ImageIcon, Video } from "lucide-react";
import { cn } from "../utils/cn";
import { MediaLightbox, type MediaItem } from "./MediaLightbox";
import type { Attachment } from "../types";

export interface MessageAttachmentsProps {
  /** List of attachments to display */
  attachments: Attachment[];
  /** Custom download handler */
  onDownload?: (attachment: Attachment) => void;
  /** Custom preview handler */
  onPreview?: (attachment: Attachment) => void;
  /** Which edge to align against — "end" for the viewer's own right-aligned
   *  messages, so a thumbnail narrower than the bubble doesn't drift left. */
  align?: "start" | "end";
  /** Additional class names */
  className?: string;
}

/**
 * Display attachments in messages: images render as inline thumbnails that open
 * a lightbox; everything else renders as a compact file chip.
 */
export function MessageAttachments({
  attachments,
  onDownload,
  onPreview,
  align = "start",
  className,
}: MessageAttachmentsProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Images whose URL failed to load (expired signed URL, revoked object URL
  // from an optimistic message, dead link). They fall back to the file chip —
  // a broken-image icon tells the user nothing and loses the download action.
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());

  // The viewable images, in render order, so the lightbox can page between
  // several images attached to one message.
  const imageItems = useMemo<MediaItem[]>(
    () =>
      (attachments ?? [])
        .filter(
          (a) => a.isImage && !!(a.previewUrl || a.url) && !brokenIds.has(a.id),
        )
        .map((a) => ({
          id: a.id,
          url: (a.url || a.previewUrl)!,
          mediaType: "image",
          altText: a.filename,
        })),
    [attachments, brokenIds],
  );

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
    const index = imageItems.findIndex((item) => item.id === attachment.id);
    if (index >= 0) {
      setLightboxIndex(index);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
    >
      {attachments.map((attachment) => {
        const showThumbnail =
          attachment.isImage &&
          !!(attachment.previewUrl || attachment.url) &&
          !brokenIds.has(attachment.id);

        return showThumbnail ? (
          <AttachmentThumbnail
            key={attachment.id}
            attachment={attachment}
            onDownload={() => handleDownload(attachment)}
            onPreview={() => handlePreview(attachment)}
            onError={() =>
              setBrokenIds((prev) => {
                if (prev.has(attachment.id)) return prev;
                const next = new Set(prev);
                next.add(attachment.id);
                return next;
              })
            }
          />
        ) : (
          <AttachmentCard
            key={attachment.id}
            attachment={attachment}
            // An image that failed to load is not previewable — offering the
            // click would open an empty lightbox.
            previewable={imageItems.some((item) => item.id === attachment.id)}
            onDownload={() => handleDownload(attachment)}
            onPreview={() => handlePreview(attachment)}
          />
        );
      })}

      {/* Image lightbox. Uses the shared MediaLightbox rather than a local
          overlay: it portals into document.body, so it escapes the transformed
          framer-motion ancestors in the chat scroll container (a plain
          `fixed inset-0` here anchors to the chat panel, not the viewport) and
          brings Esc-to-close, arrow navigation and body scroll-lock with it. */}
      {lightboxIndex !== null && imageItems.length > 0 && (
        <MediaLightbox
          items={imageItems}
          index={Math.min(lightboxIndex, imageItems.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(direction) =>
            setLightboxIndex((current) =>
              current === null
                ? current
                : (current + direction + imageItems.length) % imageItems.length,
            )
          }
        />
      )}
    </div>
  );
}

function AttachmentThumbnail({
  attachment,
  onDownload,
  onPreview,
  onError,
}: {
  attachment: Attachment;
  onDownload: () => void;
  onPreview: () => void;
  onError: () => void;
}) {
  const source = attachment.previewUrl || attachment.url;

  return (
    <div
      className={cn(
        "group/thumb relative inline-block overflow-hidden rounded-xl",
        "border border-[var(--chat-border)] bg-[var(--chat-panel-bg)]",
        "cursor-pointer transition-opacity hover:opacity-95",
      )}
      onClick={onPreview}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview();
        }
      }}
      aria-label={`Open ${attachment.filename}`}
    >
      {/* Intrinsic aspect ratio is preserved: the box only bounds the image, so
          tall screenshots and wide banners both render undistorted. */}
      <img
        src={source}
        alt={attachment.filename}
        title={attachment.filename}
        loading="lazy"
        onError={onError}
        className="block max-h-[280px] max-w-[min(320px,100%)] object-contain"
      />

      {/* Download sits on the image so the thumbnail stays uncluttered. */}
      {attachment.url && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className={cn(
            "absolute top-1.5 right-1.5 rounded-md p-1",
            "bg-black/50 text-white backdrop-blur-sm",
            "opacity-0 transition-opacity group-hover/thumb:opacity-100 focus:opacity-100",
            "hover:bg-black/70",
          )}
          aria-label={`Download ${attachment.filename}`}
        >
          <Download size={12} />
        </button>
      )}
    </div>
  );
}

function AttachmentCard({
  attachment,
  previewable = false,
  onDownload,
  onPreview,
}: {
  attachment: Attachment;
  previewable?: boolean;
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
        previewable && "cursor-pointer hover:bg-[var(--chat-border)]/30",
      )}
      onClick={previewable ? onPreview : undefined}
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
