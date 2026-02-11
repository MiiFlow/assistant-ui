import { useState, useCallback } from "react";
import { MessageCircle, Send } from "lucide-react";
import { cn } from "../utils/cn";
import type { ClarificationData } from "../types";

export interface ClarificationPanelProps {
  clarification: ClarificationData;
  onSubmit: (response: string) => void;
  onOptionSelect?: (option: string) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * Stateless clarification panel - displays when the AI agent needs user input.
 * Orange left-border panel with question, radio options, and free-text input.
 */
export function ClarificationPanel({
  clarification,
  onSubmit,
  onOptionSelect,
  disabled = false,
  loading = false,
  className,
}: ClarificationPanelProps) {
  const [freeTextInput, setFreeTextInput] = useState("");

  const handleSubmit = useCallback(
    (responseText: string) => {
      if (!responseText.trim()) return;
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

  return (
    <div
      className={cn(
        "mx-4 mb-3 px-4 py-3",
        "bg-orange-50/60 dark:bg-orange-950/20",
        "border-l-[3px] border-orange-400",
        "rounded-r-lg",
        className
      )}
    >
      {/* Question row */}
      <div className={cn("flex items-start gap-2", (hasOptions || showFreeText) && "mb-2")}>
        <span className="text-orange-600 mt-0.5">
          <MessageCircle size={14} />
        </span>
        <p className="text-sm font-medium">{clarification.question}</p>
      </div>

      {/* Options as radio buttons */}
      {hasOptions && (
        <div className={cn("ml-5 space-y-1", showFreeText && "mb-2")}>
          {clarification.options!.map((option, index) => (
            <label
              key={index}
              className="flex items-center gap-2 py-0.5 cursor-pointer text-sm hover:bg-orange-100/50 dark:hover:bg-orange-900/20 rounded px-1 -mx-1"
            >
              <input
                type="radio"
                name="clarification-option"
                value={option}
                onChange={handleOptionChange}
                disabled={disabled || loading}
                className="accent-orange-500 w-3.5 h-3.5"
              />
              {option}
            </label>
          ))}
        </div>
      )}

      {/* Free text input */}
      {showFreeText && (
        <div className="flex items-center ml-5 bg-white dark:bg-gray-900 rounded border border-orange-200 dark:border-orange-800 px-3 py-1">
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
                ? "text-orange-600 hover:text-orange-700"
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
