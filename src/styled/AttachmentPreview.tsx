import { forwardRef } from "react";
import { X, FileText, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { cn } from "../utils/cn";
import type { Attachment } from "../types";

export interface AttachmentPreviewProps {
  /** The attachment to preview */
  attachment: Attachment;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Whether removal is allowed */
  removable?: boolean;
  /** Additional CSS classes */
  className?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return ImageIcon;
  }
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  ) {
    return FileText;
  }
  return FileIcon;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Styled attachment preview card.
 */
export const AttachmentPreview = forwardRef<HTMLDivElement, AttachmentPreviewProps>(
  ({ attachment, onRemove, removable = true, className }, ref) => {
    const Icon = getFileIcon(attachment.mimeType);
    const isImage = attachment.mimeType.startsWith("image/");

    return (
      <div
        ref={ref}
        className={cn(
          "relative group",
          "flex items-center gap-2",
          "p-2 rounded-lg",
          "border border-chat-border",
          "bg-chat-panel-bg",
          className
        )}
      >
        {/* Preview or Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded",
            "flex items-center justify-center",
            "bg-gray-100 dark:bg-gray-800",
            "overflow-hidden flex-shrink-0"
          )}
        >
          {isImage && attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <Icon className="w-5 h-5 text-chat-subtle" />
          )}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-chat-text">
            {attachment.filename}
          </p>
          <p className="text-xs text-chat-subtle">
            {formatFileSize(attachment.size)}
          </p>
        </div>

        {/* Remove button */}
        {removable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              "absolute -top-1.5 -right-1.5",
              "w-5 h-5 rounded-full",
              "flex items-center justify-center",
              "bg-gray-500 text-white",
              "opacity-0 group-hover:opacity-100",
              "hover:bg-gray-600",
              "transition-opacity duration-200"
            )}
            aria-label={`Remove ${attachment.filename}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
);

AttachmentPreview.displayName = "AttachmentPreview";
