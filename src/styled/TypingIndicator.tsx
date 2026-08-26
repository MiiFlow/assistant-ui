import { forwardRef } from "react";
import { TypingIndicator as TypingIndicatorPrimitive } from "../primitives";
import { cn } from "../utils/cn";
import { LoadingDots } from "./LoadingDots";

export interface TypingIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Optional status line rendered beside the dots (e.g. "Getting started…") */
  label?: string | null;
}

/**
 * Styled TypingIndicator with animated dots and an optional status label.
 */
export const TypingIndicator = forwardRef<HTMLDivElement, TypingIndicatorProps>(
  ({ className, label }, ref) => {
    return (
      <TypingIndicatorPrimitive
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2",
          "px-4 py-3",
          className
        )}
      >
        <LoadingDots size="small" />
        {label ? (
          <span className="text-sm text-[var(--chat-text-subtle)]">{label}</span>
        ) : null}
      </TypingIndicatorPrimitive>
    );
  }
);

TypingIndicator.displayName = "TypingIndicator";
