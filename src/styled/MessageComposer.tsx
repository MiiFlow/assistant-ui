import { forwardRef, useCallback, useRef, useState, useEffect } from "react";
import { ArrowUp, Paperclip, X, FileText, Image, Loader2 } from "lucide-react";
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
// Attachment types
// ============================================================================

interface AttachmentFile {
  id: string;
  file: File;
  previewUrl?: string;
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
        return (
          <div
            key={att.id}
            className="relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 max-w-[200px]"
          >
            {isImage && att.previewUrl ? (
              <img src={att.previewUrl} alt={att.file.name} className="w-5 h-5 rounded object-cover" />
            ) : isImage ? (
              <Image size={14} className="flex-shrink-0" />
            ) : (
              <FileText size={14} className="flex-shrink-0" />
            )}
            <span className="truncate">{att.file.name}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="flex-shrink-0 ml-0.5 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
  onSubmit: (content: string, attachments?: File[]) => Promise<void>;
  /** Callback when files are attached (for upload handling) */
  onAttach?: (files: File[]) => void;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Whether attachments are supported */
  supportsAttachments?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether a message is currently being submitted */
  isSubmitting?: boolean;
}

/**
 * Rich text MessageComposer with Lexical editor, attachment support, and Enter-to-submit.
 */
export const MessageComposer = forwardRef<HTMLDivElement, MessageComposerProps>(
  (
    {
      onSubmit,
      onAttach,
      disabled = false,
      supportsAttachments = true,
      placeholder = "Type a message...",
      className,
      isSubmitting = false,
    },
    ref,
  ) => {
    const [inputText, setInputText] = useState("");
    const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const clearEditorRef = useRef<(() => void) | null>(null);

    const isDisabled = disabled || isSubmitting;
    const hasContent = inputText.trim().length > 0 || attachments.length > 0;

    const handleChange = useCallback((editorState: EditorState) => {
      editorState.read(() => {
        const value = $convertToMarkdownString(TRANSFORMERS);
        const processedValue = value
          .replace(/\n\s*\n\s*\n+/g, "\n\n")
          .replace(/(?<!\n)\n(?!\n)/g, "  \n");
        setInputText(processedValue);
      });
    }, []);

    const handleSubmit = useCallback(async () => {
      if (!hasContent || isDisabled) return;

      const text = inputText;
      const files = attachments.map((a) => a.file);

      // Clear state immediately
      clearEditorRef.current?.();
      setInputText("");
      setAttachments([]);

      try {
        await onSubmit(text, files.length > 0 ? files : undefined);
      } catch {
        // Restore on error — re-insert text
        setInputText(text);
      }
    }, [inputText, attachments, hasContent, isDisabled, onSubmit]);

    const handleFileSelect = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newAttachments: AttachmentFile[] = Array.from(files).map((file) => {
          const att: AttachmentFile = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
          };
          if (file.type.startsWith("image/")) {
            att.previewUrl = URL.createObjectURL(file);
          }
          return att;
        });

        setAttachments((prev) => [...prev, ...newAttachments]);
        onAttach?.(Array.from(files));

        // Reset so same file can be selected again
        e.target.value = "";
      },
      [onAttach],
    );

    const handleRemoveAttachment = useCallback((id: string) => {
      setAttachments((prev) => {
        const removed = prev.find((a) => a.id === id);
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        return prev.filter((a) => a.id !== id);
      });
    }, []);

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
      editable: !isDisabled,
    };

    return (
      <div
        ref={ref}
        className={cn(
          "sticky bottom-0 p-4",
          "border-t border-gray-200 dark:border-gray-700",
          "bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm",
          className,
        )}
      >
        <div
          className={cn(
            "mx-auto max-w-[900px]",
            "rounded-xl",
            "bg-white dark:bg-gray-800",
            "border border-gray-200 dark:border-gray-700",
            "shadow-sm",
            "transition-all duration-200",
            "focus-within:shadow-md focus-within:border-gray-300 dark:focus-within:border-gray-600",
          )}
        >
          {/* Attachment previews */}
          <AttachmentBar attachments={attachments} onRemove={handleRemoveAttachment} disabled={isDisabled} />

          {/* Main input row */}
          <div
            className={cn(
              "flex items-end gap-2 p-3",
              attachments.length > 0 && "pt-1.5",
            )}
          >
            {/* Paperclip button */}
            {supportsAttachments && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isDisabled}
                className={cn(
                  "flex-shrink-0 self-center",
                  "w-8 h-8 rounded-lg",
                  "flex items-center justify-center",
                  "border border-gray-200 dark:border-gray-600",
                  "text-gray-500 dark:text-gray-400",
                  "hover:bg-gray-50 dark:hover:bg-gray-700",
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
                          "text-gray-900 dark:text-gray-100",
                          "[&_.editor-paragraph]:my-0",
                          "[&_.editor-quote]:ml-0 [&_.editor-quote]:pl-3 [&_.editor-quote]:border-l-4 [&_.editor-quote]:border-gray-300",
                          "[&_ul]:pl-4 [&_ol]:pl-4",
                        )}
                      />
                    }
                    placeholder={
                      <span className="absolute top-0 left-1 text-gray-400 dark:text-gray-500 pointer-events-none select-none">
                        {placeholder}
                      </span>
                    }
                    ErrorBoundary={LexicalErrorBoundary}
                  />
                  <OnChangePlugin onChange={handleChange} />
                  <ListPlugin />
                  <HistoryPlugin />
                  <AutoFocusPlugin defaultSelection="rootStart" />
                  <EnterKeyPlugin onSubmit={handleSubmit} disabled={isDisabled} />
                  <ClearEditorPlugin clearRef={clearEditorRef} />
                </div>
              </LexicalComposer>
            </div>

            {/* Send button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasContent || isDisabled}
              className={cn(
                "flex-shrink-0",
                "w-9 h-9 rounded-lg",
                "flex items-center justify-center",
                "bg-blue-500 text-white",
                "shadow-sm",
                "hover:bg-blue-600 hover:shadow-md hover:-translate-y-px",
                "active:translate-y-0 active:shadow-sm",
                "disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed",
                "transition-all duration-200",
              )}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>

          {/* Hidden file input */}
          {supportsAttachments && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/plain,application/json,video/*"
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
