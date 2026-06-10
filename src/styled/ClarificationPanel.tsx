import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Send,
} from "lucide-react";
import { cn } from "../utils/cn";
import { MarkdownContent } from "./MarkdownContent";
import type {
  ClarificationAnswer,
  ClarificationData,
  ClarificationQuestion,
} from "../types";

export interface ClarificationPanelProps {
  clarification: ClarificationData;
  /**
   * Called on submit with both the human-readable text (for the transcript) AND
   * the structured per-question answers (for deterministic server-side capture —
   * no parsing of the text).
   */
  onSubmit?: (response: string, answers: ClarificationAnswer[]) => void;
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
 * `question`/`options` shape so old history still renders. Question dicts
 * arrive VERBATIM from the server (snake_case wire format), so both casings
 * are resolved here.
 */
function resolveQuestions(c: ClarificationData): ClarificationQuestion[] {
  if (c.questions && c.questions.length > 0) {
    return c.questions.map((q) => ({
      question: q.question,
      options: q.options || [],
      multiSelect: q.multiSelect ?? q.multi_select,
      key: q.key,
    }));
  }
  if (c.question) {
    return [
      {
        question: c.question,
        options: c.options || [],
        multiSelect: false,
      },
    ];
  }
  return [];
}

/**
 * A question's effective answer: the picked options plus the typed free-text
 * value when present. Free text is ADDITIVE — the user can pick an option,
 * type their own, or both ("Brand only" + a couple of extra keywords).
 */
function resolveSelected(
  picked: string[],
  typed: string | undefined,
): string[] {
  const t = (typed || "").trim();
  return t ? [...picked, t] : picked;
}

/** Build the structured per-question answers for deterministic server capture. */
function buildStructuredAnswers(
  questions: ClarificationQuestion[],
  selections: Record<number, string[]>,
  freeText: Record<number, string>,
): ClarificationAnswer[] {
  return questions.map((q, i) => ({
    key: q.key,
    question: q.question,
    selected: resolveSelected(selections[i] || [], freeText[i]),
  }));
}

/** Build the answer text the model reads back as the tool result. */
function formatAnswer(
  questions: ClarificationQuestion[],
  selections: Record<number, string[]>,
  freeText: Record<number, string>,
): string {
  return questions
    .map((q, i) => {
      const picked = resolveSelected(selections[i] || [], freeText[i]);
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
  const [freeText, setFreeText] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState(0);
  const isAnswered = typeof answer === "string" && answer.length > 0;
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  /**
   * Move to the first still-unanswered question after `from`, falling back to
   * the next question. Keeps the user moving forward without forcing them past
   * questions they've already handled out of order.
   */
  const advanceFrom = useCallback(
    (from: number, sel: Record<number, string[]>) => {
      for (let i = from + 1; i < questions.length; i++) {
        if ((sel[i] || []).length === 0) {
          setActiveTab(i);
          return;
        }
      }
      if (from + 1 < questions.length) setActiveTab(from + 1);
    },
    [questions.length],
  );

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
        const updated = { ...prev, [qIndex]: next };
        // Single-select is a committed choice — auto-advance so the user flows
        // through the set without reaching for the tabs. Multi-select waits,
        // since they may still be picking more options.
        if (!multi) {
          if (advanceTimer.current) clearTimeout(advanceTimer.current);
          advanceTimer.current = setTimeout(() => advanceFrom(qIndex, updated), 250);
        }
        return updated;
      });
    },
    [onOptionSelect, advanceFrom],
  );

  // A question is answered by picking options, typing a custom value, or both.
  const allAnswered =
    questions.length > 0 &&
    questions.every(
      (_, i) =>
        (selections[i] || []).length > 0 || (freeText[i] || "").trim().length > 0,
    );

  const submit = useCallback(() => {
    if (!onSubmit || !allAnswered) return;
    const text = formatAnswer(questions, selections, freeText);
    const structured = buildStructuredAnswers(questions, selections, freeText);
    setSelections({});
    setFreeText({});
    setActiveTab(0);
    onSubmit(text, structured);
  }, [onSubmit, allAnswered, questions, selections, freeText]);

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
          {/* Always-present free-text channel, ADDITIVE to the options: the
              user can pick a choice, type their own value, or combine both
              ("Brand only" + two extra keywords). Empty = ignored. */}
          <div className="flex items-center gap-2 py-0.5 px-1 -mx-1 text-sm">
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400">
              Other:
            </span>
            <input
              type="text"
              value={freeText[qi] || ""}
              placeholder={
                picked.length > 0
                  ? "Add anything else… (optional)"
                  : "Or type your own answer…"
              }
              onChange={(e) =>
                setFreeText((prev) => ({ ...prev, [qi]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (
                    (freeText[qi] || "").trim() ||
                    (selections[qi] || []).length > 0
                  )
                    advanceFrom(qi, selections);
                }
              }}
              disabled={disabled || loading}
              className={cn(
                "flex-1 min-w-0 px-2 py-0.5 text-sm rounded border bg-transparent",
                "border-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_40%,transparent)]",
                "focus:outline-none focus:border-[var(--chat-clarification-accent,#f97316)]",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500",
              )}
            />
          </div>
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
                onClick={() => {
                  if (advanceTimer.current) clearTimeout(advanceTimer.current);
                  setActiveTab(qi);
                }}
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
        <div className="flex items-center gap-1">
          {multiQuestion ? (
            <>
              <button
                type="button"
                aria-label="Previous question"
                onClick={() => {
                  if (advanceTimer.current) clearTimeout(advanceTimer.current);
                  setActiveTab((t) => Math.max(0, t - 1));
                }}
                disabled={active === 0}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded transition-colors",
                  active === 0
                    ? "text-gray-300 dark:text-gray-600 cursor-default"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_18%,transparent)]",
                )}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label="Next question"
                onClick={() => {
                  if (advanceTimer.current) clearTimeout(advanceTimer.current);
                  setActiveTab((t) => Math.min(questions.length - 1, t + 1));
                }}
                disabled={active === questions.length - 1}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded transition-colors mr-1",
                  active === questions.length - 1
                    ? "text-gray-300 dark:text-gray-600 cursor-default"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_18%,transparent)]",
                )}
              >
                <ChevronRight size={16} />
              </button>
            </>
          ) : null}
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
    </div>
  );
}
