import {
  createContext,
  useContext,
  forwardRef,
  type ReactNode,
  type TextareaHTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";
import { useMessageComposer } from "../hooks/use-message-composer";

interface ComposerContextValue {
  content: string;
  isSubmitting: boolean;
  canSubmit: boolean;
  error: string | null;
  handleContentChange: (value: string) => void;
  handleSubmit: () => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

/**
 * Hook to access the composer context.
 * Must be used within a MessageComposer component.
 */
export function useComposer() {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error("useComposer must be used within a MessageComposer component");
  }
  return context;
}

export interface MessageComposerProps {
  /** Callback when message is submitted */
  onSubmit: (content: string, attachments?: File[]) => Promise<void>;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Children to render inside the composer */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Headless MessageComposer primitive.
 * Provides composer state and behavior to children.
 */
export const MessageComposer = forwardRef<HTMLFormElement, MessageComposerProps>(
  ({ onSubmit, disabled = false, children, className }, ref) => {
    const composer = useMessageComposer({ onSubmit, disabled });

    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      composer.handleSubmit();
    };

    const contextValue: ComposerContextValue = {
      ...composer,
      canSubmit: Boolean(composer.canSubmit),
    };

    return (
      <ComposerContext.Provider value={contextValue}>
        <form
          ref={ref}
          className={className}
          onSubmit={handleFormSubmit}
          data-submitting={composer.isSubmitting}
          data-can-submit={composer.canSubmit}
        >
          {children}
        </form>
      </ComposerContext.Provider>
    );
  }
);

MessageComposer.displayName = "MessageComposer";

export interface ComposerInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {}

/**
 * Text input for the message composer.
 */
export const ComposerInput = forwardRef<HTMLTextAreaElement, ComposerInputProps>(
  (props, ref) => {
    const { content, handleContentChange, handleKeyDown, inputRef } = useComposer();

    // Merge refs
    const mergedRef = (node: HTMLTextAreaElement | null) => {
      (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <textarea
        ref={mergedRef}
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);

ComposerInput.displayName = "ComposerInput";

export interface ComposerSubmitProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * Submit button for the message composer.
 */
export const ComposerSubmit = forwardRef<HTMLButtonElement, ComposerSubmitProps>(
  ({ children, disabled, ...props }, ref) => {
    const { canSubmit, isSubmitting } = useComposer();

    return (
      <button
        ref={ref}
        type="submit"
        disabled={disabled || !canSubmit}
        data-submitting={isSubmitting}
        {...props}
      >
        {children}
      </button>
    );
  }
);

ComposerSubmit.displayName = "ComposerSubmit";

export { ComposerContext };
