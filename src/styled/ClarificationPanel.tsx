import { useState, useCallback } from "react";
import { Check, ChevronDown, HelpCircle, Send } from "lucide-react";
import { cn } from "../utils/cn";
import { MarkdownContent } from "./MarkdownContent";
import type { ClarificationData } from "../types";

export interface ClarificationPanelProps {
  clarification: ClarificationData;
  onSubmit?: (response: string) => void;
  onOptionSelect?: (option: string) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /**
   * When set, renders a read-only "answered" state showing the user's response
   * inline with the question. Used in scrolled-back chat history so a past
   * clarification still shows what was asked and answered.
   */
  answer?: string;
}

/**
 * Stateless clarification panel - displays when the AI agent needs user input.
 * Orange left-border panel with question, radio options, and free-text input.
 *
 * If `answer` is provided, switches to a read-only "answered" view.
 */
export function ClarificationPanel({
  clarification,
  onSubmit,
  onOptionSelect,
  disabled = false,
  loading = false,
  className,
  answer,
}: ClarificationPanelProps) {
  const [freeTextInput, setFreeTextInput] = useState("");
  const isAnswered = typeof answer === "string" && answer.length > 0;

  const handleSubmit = useCallback(
    (responseText: string) => {
      if (!responseText.trim() || !onSubmit) return;
      setFreeTextInput("");
      onSubmit(responseText.trim());
    },
    [onSubmit]
  );

  const handleOptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedOption = event.target.value;
    onOptionSelect?.(selectedOption);
    handleSubmit(selectedOption);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && freeTextInput.trim()) {
      e.preventDefault();
      handleSubmit(freeTextInput);
    }
  };

  const hasOptions = clarification.options && clarification.options.length > 0;
  const showFreeText = clarification.allowFreeText !== false;

  if (isAnswered) {
    return (
      <div className={cn("mx-4 mb-3 flex justify-end font-sans", className)}>
        <details className="group max-w-[85%]">
          <summary
            className={cn(
              "flex items-center justify-end gap-1.5 cursor-pointer select-none",
              "text-xs text-gray-600 dark:text-gray-300",
              "hover:text-gray-900 dark:hover:text-gray-100 transition-colors",
              "list-none [&::-webkit-details-marker]:hidden"
            )}
          >
            <Check
              size={12}
              strokeWidth={2.75}
              className="text-emerald-600 dark:text-emerald-500"
            />
            <span>Clarification answered</span>
            <ChevronDown
              size={12}
              className="text-gray-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-2 text-right">
            <MarkdownContent className="text-sm text-gray-700 dark:text-gray-200 text-left">
              {clarification.question}
            </MarkdownContent>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words">
              {answer}
            </p>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-4 mb-3 px-4 py-3 font-sans",
        "bg-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_12%,transparent)]",
        "border-l-[3px] border-[var(--chat-clarification-accent,#f97316)]",
        "rounded-r-lg",
        className
      )}
    >
      {/* Question row — capped height + internal scroll so a long multi-part
          question (e.g. an LLM that emits a numbered list of sub-questions
          with bullet sub-options) doesn't push the options/input off-screen
          and break the chat layout. The cap is generous (40vh) so short
          questions still render at natural size. */}
      <div className={cn("flex items-start gap-2", (hasOptions || showFreeText) && "mb-2")}>
        <span className="text-[var(--chat-clarification-accent,#f97316)] mt-0.5 flex-shrink-0">
          <HelpCircle size={14} />
        </span>
        <div className="flex-1 min-w-0 max-h-[40vh] overflow-y-auto pr-1">
          <MarkdownContent className="text-sm font-medium">
            {clarification.question}
          </MarkdownContent>
        </div>
      </div>

      {/* Options as radio buttons */}
      {hasOptions && (
        <div className={cn("ml-5 space-y-1", showFreeText && "mb-2")}>
          {clarification.options!.map((option, index) => (
            <label
              key={index}
              className="flex items-center gap-2 py-0.5 cursor-pointer text-sm hover:bg-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_18%,transparent)] rounded px-1 -mx-1"
            >
              <input
                type="radio"
                name="clarification-option"
                value={option}
                onChange={handleOptionChange}
                disabled={disabled || loading}
                className="accent-[var(--chat-clarification-accent,#f97316)] w-3.5 h-3.5"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {/* Free text input */}
      {showFreeText && (
        <div className="flex items-center ml-5 bg-white dark:bg-gray-900 rounded border border-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_30%,transparent)] px-3 py-1">
          <input
            type="text"
            value={freeTextInput}
            onChange={(e) => setFreeTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasOptions ? "Or type your response..." : "Type your response..."}
            disabled={disabled || loading}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400 disabled:opacity-50"
          />
          <button
            onClick={() => handleSubmit(freeTextInput)}
            disabled={!freeTextInput.trim() || disabled || loading}
            className={cn(
              "p-1 rounded transition-colors",
              freeTextInput.trim()
                ? "text-[var(--chat-clarification-accent,#f97316)] hover:text-[var(--chat-clarification-accent-soft,#fdba74)]"
                : "text-gray-300"
            )}
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
