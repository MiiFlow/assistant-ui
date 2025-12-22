import { forwardRef } from "react";
import { Send } from "lucide-react";
import {
  MessageComposer as ComposerPrimitive,
  ComposerInput,
  ComposerSubmit,
  useComposer,
} from "../primitives";
import { cn } from "../utils/cn";

export interface MessageComposerProps {
  /** Callback when message is submitted */
  onSubmit: (content: string, attachments?: File[]) => Promise<void>;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Styled MessageComposer with input and send button.
 */
export const MessageComposer = forwardRef<HTMLFormElement, MessageComposerProps>(
  ({ onSubmit, disabled = false, placeholder = "Type a message...", className }, ref) => {
    return (
      <ComposerPrimitive
        ref={ref}
        onSubmit={onSubmit}
        disabled={disabled}
        className={cn(
          "sticky bottom-0 p-4",
          "border-t border-chat-border",
          "bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm",
          className
        )}
      >
        <ComposerContent placeholder={placeholder} disabled={disabled} />
      </ComposerPrimitive>
    );
  }
);

MessageComposer.displayName = "MessageComposer";

function ComposerContent({
  placeholder,
  disabled,
}: {
  placeholder: string;
  disabled: boolean;
}) {
  const { isSubmitting } = useComposer();

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        "bg-white dark:bg-gray-800",
        "border border-chat-border rounded-input",
        "p-2",
        "shadow-input",
        "focus-within:shadow-input-focus focus-within:border-chat-border-hover",
        "transition-all duration-200"
      )}
    >
      <ComposerInput
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        className={cn(
          "flex-1 resize-none",
          "min-h-[40px] max-h-[200px]",
          "px-2 py-2",
          "bg-transparent",
          "text-chat-text placeholder:text-chat-subtle",
          "focus:outline-none",
          "disabled:opacity-50"
        )}
        rows={1}
      />
      <ComposerSubmit
        disabled={disabled}
        className={cn(
          "flex-shrink-0",
          "w-10 h-10 rounded-button",
          "flex items-center justify-center",
          "bg-primary text-white",
          "shadow-button",
          "hover:shadow-button-hover hover:brightness-110",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-button",
          "transition-all duration-200"
        )}
      >
        <Send className="w-5 h-5" />
      </ComposerSubmit>
    </div>
  );
}

export { useComposer } from "../primitives";
