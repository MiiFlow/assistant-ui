import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import type { CommandProvider } from "../composer";
import { cn } from "../utils/cn";
import { Avatar } from "./Avatar";
import { MessageComposer } from "./MessageComposer";
import { usePrefersReducedMotion } from "../hooks/use-reduced-motion";
import { MessageCircle, Sparkles } from "lucide-react";

export type WelcomeSuggestion =
  | string
  | {
      /** Message submitted when selected. The visible title labels the button. */
      message: string;
      title: string;
      description?: string;
      icon?: ReactNode;
    };

export interface WelcomeScreenProps {
  /** Rotating placeholder strings displayed in the input */
  placeholders?: string[];
  /** Suggested messages shown beneath the heading or composer */
  suggestions?: WelcomeSuggestion[];
  /** Called when the user submits a message via the built-in input */
  onSubmit?: (
    message: string,
    files?: File[],
  ) => void | Promise<void | { accepted?: boolean }>;
  /** Called when the user clicks a suggestion card */
  onSuggestionClick?: (suggestion: string) => void;
  /** Welcome heading text */
  welcomeText?: string;
  /** Supporting text beneath the heading. */
  description?: string;
  /** Brand mark displayed within the welcome glow; avatar takes precedence. */
  emblem?: ReactNode;
  /** Intro leaves composing to ChatLayout with showComposerOnWelcome enabled. */
  layout?: "centered" | "intro";
  /** Whether to show the attachment (paperclip) button */
  supportsAttachments?: boolean;
  /** Blocks the built-in input (e.g. while a response is already streaming).
   *  Ignored when `composerSlot` is provided — that composer owns its own gating. */
  disabled?: boolean;
  /** Override the shared message composer with a host-owned composer */
  composerSlot?: ReactNode;
  /** Optional slash-command typeahead provider (e.g. for skill picker). */
  commandProvider?: CommandProvider | null;
  /** Multiple typeahead providers for distinct triggers (e.g. `/` skills +
   *  modes plus `@` ad accounts). Takes precedence over `commandProvider`. */
  commandProviders?: CommandProvider[];
  /** Additional CSS classes for the outer wrapper */
  className?: string;
  /** Assistant avatar image URL, shown above the heading */
  assistantAvatar?: string;
  /** Assistant display name (shown alongside avatar) */
  assistantName?: string;
}

function useRotatingPlaceholder(placeholders: string[], intervalMs = 3000) {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (placeholders.length <= 1 || reducedMotion) return;

    const start = () => {
      intervalRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % placeholders.length);
      }, intervalMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [placeholders, intervalMs, reducedMotion]);

  return placeholders[index] ?? "";
}

/** Shared starting screen for full-page chat and compact assistant hosts. */
export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
  (
    {
      placeholders = [],
      suggestions = [],
      onSubmit,
      onSuggestionClick,
      welcomeText = "What would you like to work on?",
      description,
      emblem,
      layout = "centered",
      supportsAttachments = false,
      disabled,
      composerSlot,
      commandProvider,
      commandProviders,
      className,
      assistantAvatar,
      assistantName,
    },
    ref,
  ) => {
    const placeholder = useRotatingPlaceholder(placeholders);
    return (
      <div
        ref={ref}
        className={cn("chat-welcome", className)}
        data-layout={layout}
      >
        <div className="chat-welcome-content">
          <div className="chat-welcome-intro">
            <div className="chat-welcome-emblem" aria-hidden="true">
              {assistantAvatar ? (
                <Avatar
                  name={assistantName}
                  src={assistantAvatar}
                  role="assistant"
                  className="w-14 h-14"
                />
              ) : (
                (emblem ?? <Sparkles size={38} strokeWidth={1.5} />)
              )}
            </div>
            {welcomeText && <h2>{welcomeText}</h2>}
            {description && <p>{description}</p>}
          </div>
          {layout === "centered" && (
            <div className="chat-welcome-composer">
              {composerSlot ?? (
                <MessageComposer
                  centered
                  placeholder={placeholder}
                  onSubmit={async (msg, files) => onSubmit?.(msg, files)}
                  supportsAttachments={supportsAttachments}
                  disabled={disabled || !onSubmit}
                  commandProvider={commandProvider ?? null}
                  commandProviders={commandProviders}
                />
              )}
            </div>
          )}
          {suggestions.length > 0 && (
            <div
              className="chat-welcome-suggestions"
              role="group"
              aria-label="Suggested messages"
            >
              {suggestions.map((suggestion, index) => {
                const { message, title, description, icon } =
                  typeof suggestion === "string"
                    ? {
                        message: suggestion,
                        title: suggestion,
                        description: undefined,
                        icon: undefined,
                      }
                    : suggestion;
                return (
                  <button
                    key={`${index}-${message}`}
                    type="button"
                    aria-label={title}
                    disabled={disabled || !onSuggestionClick}
                    onClick={() => onSuggestionClick?.(message)}
                  >
                    <span
                      className="chat-welcome-suggestion-icon"
                      aria-hidden="true"
                    >
                      {icon ?? <MessageCircle size={20} strokeWidth={1.6} />}
                    </span>
                    <span className="chat-welcome-suggestion-copy">
                      <span className="chat-welcome-suggestion-title">
                        {title}
                      </span>
                      {description && (
                        <span className="chat-welcome-suggestion-description">
                          {description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  },
);
WelcomeScreen.displayName = "WelcomeScreen";
