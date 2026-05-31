import { useState, useCallback, useMemo } from "react";
import { Check, ChevronDown, HelpCircle, Send } from "lucide-react";
import { cn } from "../utils/cn";
import { MarkdownContent } from "./MarkdownContent";
import type { ClarificationData, ClarificationQuestion } from "../types";

export interface ClarificationPanelProps {
  clarification: ClarificationData;
  onSubmit?: (response: string) => void;
  /** Best-effort callback fired when an option is selected (legacy hook). */
  onOptionSelect?: (option: string) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /**
   * When set, renders a read-only "answered" state showing the user's response
   * inline. Used in scrolled-back chat history so a past clarification still
   * shows what was answered.
   */
  answer?: string;
}

/**
 * Normalize whatever shape arrived into a list of multiple-choice questions.
 * Prefers the current `questions` array; falls back to the legacy single
 * `question`/`options` shape so old history still renders.
 */
function resolveQuestions(c: ClarificationData): ClarificationQuestion[] {
  if (c.questions && c.questions.length > 0) {
    return c.questions.map((q) => ({
      question: q.question,
      options: q.options || [],
      multiSelect: q.multiSelect,
    }));
  }
  if (c.question) {
    return [{ question: c.question, options: c.options || [], multiSelect: false }];
  }
  return [];
}

/** Build the answer text the model reads back as the tool result. */
function formatAnswer(
  questions: ClarificationQuestion[],
  selections: Record<number, string[]>,
): string {
  return questions
    .map((q, i) => {
      const picked = selections[i] || [];
      const ans = picked.length > 0 ? picked.join(", ") : "(no answer)";
      const prefix = questions.length > 1 ? `${i + 1}. ` : "";
      return `${prefix}${q.question}\n→ ${ans}`;
    })
    .join("\n\n");
}

/**
 * Clarification panel — displays when the agent needs the user to pick from
 * one or more multiple-choice questions. Orange left-border panel.
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
  const questions = useMemo(() => resolveQuestions(clarification), [clarification]);
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [activeTab, setActiveTab] = useState(0);
  const isAnswered = typeof answer === "string" && answer.length > 0;

  const toggle = useCallback(
    (qIndex: number, option: string, multi: boolean) => {
      setSelections((prev) => {
        const current = prev[qIndex] || [];
        let next: string[];
        if (multi) {
          next = current.includes(option)
            ? current.filter((o) => o !== option)
            : [...current, option];
        } else {
          next = [option];
        }
        if (next.includes(option)) onOptionSelect?.(option);
        return { ...prev, [qIndex]: next };
      });
    },
    [onOptionSelect],
  );

  const allAnswered =
    questions.length > 0 &&
    questions.every((_, i) => (selections[i] || []).length > 0);

  const submit = useCallback(() => {
    if (!onSubmit || !allAnswered) return;
    const text = formatAnswer(questions, selections);
    setSelections({});
    setActiveTab(0);
    onSubmit(text);
  }, [onSubmit, allAnswered, questions, selections]);

  if (isAnswered) {
    return (
      <div className={cn("mx-4 mb-3 flex justify-end font-sans", className)}>
        <details className="group max-w-[85%]">
          <summary
            className={cn(
              "flex items-center justify-end gap-1.5 cursor-pointer select-none",
              "text-xs text-gray-600 dark:text-gray-300",
              "hover:text-gray-900 dark:hover:text-gray-100 transition-colors",
              "list-none [&::-webkit-details-marker]:hidden",
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
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words text-left">
              {answer}
            </p>
          </div>
        </details>
      </div>
    );
  }

  if (questions.length === 0) return null;

  const accent = "var(--chat-clarification-accent,#f97316)";
  const multiQuestion = questions.length > 1;
  const active = Math.min(activeTab, questions.length - 1);

  const renderQuestion = (qi: number) => {
    const q = questions[qi];
    const multi = !!q.multiSelect;
    const picked = selections[qi] || [];
    return (
      <div>
        <div className="flex items-start gap-2 mb-1.5">
          {!clarification.context && !multiQuestion ? (
            <span className="text-[var(--chat-clarification-accent,#f97316)] mt-0.5 flex-shrink-0">
              <HelpCircle size={14} />
            </span>
          ) : null}
          <div className="flex-1 min-w-0">
            <MarkdownContent className="text-sm font-medium">
              {q.question}
            </MarkdownContent>
          </div>
        </div>
        <div className="ml-5 space-y-1">
          {q.options.map((option, oi) => {
            const selected = picked.includes(option);
            return (
              <label
                key={oi}
                className={cn(
                  "flex items-center gap-2 py-0.5 cursor-pointer text-sm rounded px-1 -mx-1",
                  "hover:bg-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_18%,transparent)]",
                )}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={`clarification-q${qi}`}
                  value={option}
                  checked={selected}
                  onChange={() => toggle(qi, option, multi)}
                  disabled={disabled || loading}
                  className="w-3.5 h-3.5"
                  style={{ accentColor: accent }}
                />
                {option}
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "mx-4 mb-3 px-4 py-3 font-sans",
        "bg-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_12%,transparent)]",
        "border-l-[3px] border-[var(--chat-clarification-accent,#f97316)]",
        "rounded-r-lg",
        className,
      )}
    >
      {clarification.context ? (
        <div className="flex items-start gap-2 mb-2">
          <span className="text-[var(--chat-clarification-accent,#f97316)] mt-0.5 flex-shrink-0">
            <HelpCircle size={14} />
          </span>
          <div className="flex-1 min-w-0">
            <MarkdownContent className="text-sm text-gray-600 dark:text-gray-300">
              {clarification.context}
            </MarkdownContent>
          </div>
        </div>
      ) : null}

      {/* Multiple questions render as tabs — one question per tab — so a long
          set doesn't stack into a wall of radios. A single question renders
          inline with no tab strip. */}
      {multiQuestion ? (
        <div
          role="tablist"
          aria-label="Clarification questions"
          className="flex items-center gap-1 mb-2 border-b border-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_30%,transparent)]"
        >
          {questions.map((_, qi) => {
            const isActive = qi === active;
            const isDone = (selections[qi] || []).length > 0;
            return (
              <button
                key={qi}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(qi)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-xs rounded-t -mb-px border-b-2 transition-colors",
                  isActive
                    ? "border-[var(--chat-clarification-accent,#f97316)] text-[var(--chat-clarification-accent,#f97316)] font-medium"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
                )}
              >
                {isDone ? (
                  <Check
                    size={11}
                    strokeWidth={3}
                    className="text-emerald-600 dark:text-emerald-500"
                  />
                ) : null}
                <span>{qi + 1}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="max-h-[50vh] overflow-y-auto pr-1">{renderQuestion(active)}</div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {multiQuestion ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {(() => {
              const done = questions.filter((_, i) => (selections[i] || []).length > 0).length;
              return `${done} of ${questions.length} answered`;
            })()}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={submit}
          disabled={!allAnswered || disabled || loading}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors",
            allAnswered
              ? "text-[var(--chat-clarification-accent,#f97316)] hover:text-[var(--chat-clarification-accent-soft,#fdba74)]"
              : "text-gray-300 dark:text-gray-600",
          )}
        >
          <span className="text-xs">Submit</span>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
