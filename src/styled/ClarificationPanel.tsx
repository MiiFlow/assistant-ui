import { useState, useCallback, useMemo, useRef, useEffect, useId } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, HelpCircle, Send } from "lucide-react";
import { cn } from "../utils/cn";
import { MarkdownContent } from "./MarkdownContent";
import type { ClarificationAnswer, ClarificationData, ClarificationQuestion } from "../types";

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
function resolveSelected(picked: string[], typed: string | undefined): string[] {
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
  const id = useId();
  const active = Math.min(activeTab, questions.length - 1);
  const questionRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusQuestion = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  }, []);

  useEffect(() => {
    cancelAdvance();
    return cancelAdvance;
  }, [cancelAdvance, clarification, disabled, loading, isAnswered]);

  const focusFirstAnswer = useCallback(() => {
    questionRef.current
      ?.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled)")
      ?.focus();
  }, []);

  useEffect(() => {
    if (focusQuestion.current && !disabled && !loading && !isAnswered) {
      focusFirstAnswer();
    }
    focusQuestion.current = false;
  }, [active, disabled, loading, isAnswered, focusFirstAnswer]);

  const showQuestion = useCallback(
    (index: number, moveFocus = false) => {
      cancelAdvance();
      focusQuestion.current = moveFocus;
      setActiveTab(index);
      if (moveFocus && index === active) {
        focusFirstAnswer();
        focusQuestion.current = false;
      }
    },
    [active, cancelAdvance, focusFirstAnswer],
  );

  /**
   * A question counts as answered by picking options, typing a custom value,
   * or both. Submit already used this rule while the counter, the tab tick and
   * auto-advance each looked at selections only, so a free-text-only answer
   * enabled Submit while still being reported as unanswered (BUG-070).
   */
  const isQuestionAnswered = useCallback(
    (
      index: number,
      sel: Record<number, string[]> = selections,
      txt: Record<number, string> = freeText,
    ) => (sel[index] || []).length > 0 || (txt[index] || "").trim().length > 0,
    [selections, freeText],
  );

  /**
   * Find the next unanswered question, wrapping for answers given out of order.
   * Once all are answered, keep the existing forward navigation for reviewing.
   */
  const advanceFrom = useCallback(
    (from: number, sel: Record<number, string[]>, moveFocus = true) => {
      for (let offset = 1; offset < questions.length; offset++) {
        const i = (from + offset) % questions.length;
        if (!isQuestionAnswered(i, sel)) {
          showQuestion(i, moveFocus);
          return;
        }
      }
      if (from + 1 < questions.length) showQuestion(from + 1, moveFocus);
    },
    [questions.length, isQuestionAnswered, showQuestion],
  );

  const toggle = useCallback(
    (qIndex: number, option: string, multi: boolean) => {
      if (disabled || loading) return;
      cancelAdvance();
      const current = selections[qIndex] || [];
      const next = multi
        ? current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option]
        : [option];
      const updated = { ...selections, [qIndex]: next };
      setSelections(updated);
      if (next.includes(option)) onOptionSelect?.(option);
      // Preserve single-choice auto-advance, but let Tab/Shift+Tab cancel it
      // so a delayed transition cannot steal focus from the user's next control.
      if (!multi) {
        advanceTimer.current = setTimeout(() => {
          advanceFrom(qIndex, updated, !!questionRef.current?.contains(document.activeElement));
        }, 250);
      }
    },
    [disabled, loading, cancelAdvance, selections, onOptionSelect, advanceFrom],
  );

  const allAnswered = questions.length > 0 && questions.every((_, i) => isQuestionAnswered(i));

  const submit = useCallback(() => {
    if (!onSubmit || !allAnswered || disabled || loading) return;
    cancelAdvance();
    const text = formatAnswer(questions, selections, freeText);
    const structured = buildStructuredAnswers(questions, selections, freeText);
    setSelections({});
    setFreeText({});
    setActiveTab(0);
    onSubmit(text, structured);
  }, [onSubmit, allAnswered, disabled, loading, cancelAdvance, questions, selections, freeText]);

  const focusStyle =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:focus-visible:outline-gray-100";

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
              focusStyle,
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
          <div id={`${id}-question-${qi}`} className="flex-1 min-w-0">
            <MarkdownContent className="text-sm font-medium">{q.question}</MarkdownContent>
          </div>
        </div>
        <p id={`${id}-instructions-${qi}`} className="sr-only">
          {q.options.length > 0 ? (
            <>
              {multi ? "Choose one or more options." : "Choose one option."}
              {!multi && multiQuestion && " Selecting an option advances to the next question."}
              {
                " Use Tab to move between answers and Enter or Space to select. You can also type your own answer."
              }
            </>
          ) : (
            "Type your answer."
          )}
          {" Press Enter in the text field to continue or submit when all questions are answered."}
        </p>
        <div
          role="group"
          aria-labelledby={`${id}-question-${qi}`}
          aria-describedby={`${id}-instructions-${qi}`}
          className="ml-5 space-y-1"
        >
          {q.options.map((option, oi) => {
            const selected = picked.includes(option);
            return (
              <button
                key={oi}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(qi, option, multi)}
                disabled={disabled || loading}
                className={cn(
                  "flex w-full items-center gap-2 py-0.5 cursor-pointer text-left text-sm rounded px-1 -mx-1 disabled:cursor-default",
                  "hover:bg-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_18%,transparent)]",
                  focusStyle,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex w-3.5 h-3.5 shrink-0 items-center justify-center border",
                    multi ? "rounded-sm" : "rounded-full",
                    selected
                      ? "border-transparent text-white"
                      : "border-gray-400 dark:border-gray-500",
                  )}
                  style={selected ? { backgroundColor: accent } : undefined}
                >
                  {selected &&
                    (multi ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    ))}
                </span>
                {option}
              </button>
            );
          })}
          {/* Always-present free-text channel, ADDITIVE to the options: the
              user can pick a choice, type their own value, or combine both
              ("Brand only" + two extra keywords). Empty = ignored. */}
          <div className="flex items-center gap-2 py-0.5 px-1 -mx-1 text-sm">
            <label
              id={`${id}-other-label-${qi}`}
              htmlFor={`${id}-other-${qi}`}
              className="flex-shrink-0 text-gray-500 dark:text-gray-400"
            >
              Other:
            </label>
            <input
              id={`${id}-other-${qi}`}
              aria-labelledby={`${id}-question-${qi} ${id}-other-label-${qi}`}
              type="text"
              value={freeText[qi] || ""}
              placeholder={
                picked.length > 0 ? "Add anything else… (optional)" : "Or type your own answer…"
              }
              onChange={(e) => setFreeText((prev) => ({ ...prev, [qi]: e.target.value }))}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  e.nativeEvent.keyCode !== 229 &&
                  !e.repeat
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (disabled || loading) return;
                  if (allAnswered) submit();
                  else if (isQuestionAnswered(qi)) advanceFrom(qi, selections);
                }
              }}
              disabled={disabled || loading}
              className={cn(
                "flex-1 min-w-0 px-2 py-0.5 text-sm rounded border bg-transparent",
                "border-[color-mix(in_oklab,var(--chat-clarification-accent,#f97316)_40%,transparent)]",
                "focus:outline-none focus:border-[var(--chat-clarification-accent,#f97316)]",
                "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                focusStyle,
              )}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      onBlurCapture={cancelAdvance}
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
            const isDone = isQuestionAnswered(qi);
            return (
              <button
                key={qi}
                ref={(element) => {
                  tabRefs.current[qi] = element;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${qi}`}
                aria-label={`Question ${qi + 1} of ${questions.length}${isDone ? ", answered" : ""}`}
                aria-selected={isActive}
                aria-controls={`${id}-panel-${qi}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => showQuestion(qi)}
                onKeyDown={(e) => {
                  let next: number;
                  if (e.key === "ArrowRight") next = (qi + 1) % questions.length;
                  else if (e.key === "ArrowLeft")
                    next = (qi - 1 + questions.length) % questions.length;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = questions.length - 1;
                  else return;
                  e.preventDefault();
                  showQuestion(next);
                  tabRefs.current[next]?.focus();
                }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-xs rounded-t -mb-px border-b-2 transition-colors",
                  focusStyle,
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

      {questions.map((_, qi) => (
        <div
          key={qi}
          ref={qi === active ? questionRef : undefined}
          id={`${id}-panel-${qi}`}
          role={multiQuestion ? "tabpanel" : undefined}
          aria-labelledby={multiQuestion ? `${id}-tab-${qi}` : undefined}
          hidden={qi !== active}
          className="max-h-[50vh] overflow-y-auto pr-1"
        >
          {renderQuestion(qi)}
        </div>
      ))}

      <div className="mt-2 flex items-center justify-between gap-2">
        {multiQuestion ? (
          <span role="status" className="text-xs text-gray-500 dark:text-gray-400">
            {(() => {
              const done = questions.filter((_, i) => isQuestionAnswered(i)).length;
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
                onClick={() => showQuestion(Math.max(0, active - 1), true)}
                disabled={active === 0}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded transition-colors",
                  focusStyle,
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
                onClick={() => showQuestion(Math.min(questions.length - 1, active + 1), true)}
                disabled={active === questions.length - 1}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded transition-colors mr-1",
                  focusStyle,
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
            type="button"
            onClick={submit}
            disabled={!allAnswered || disabled || loading}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors",
              focusStyle,
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
