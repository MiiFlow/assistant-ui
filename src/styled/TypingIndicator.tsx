import { type ReactNode, forwardRef } from "react";
import { TypingIndicator as TypingIndicatorPrimitive } from "../primitives";
import { cn } from "../utils/cn";
import { ThinkingIndicator } from "./ThinkingIndicator";

export interface TypingIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Optional status line rendered beside the mark (e.g. "Getting started…") */
  label?: string | null;
  /** Brand mark for the waiting state, supplied by the host. */
  mark?: ReactNode;
}

/**
 * The pre-first-token waiting state.
 *
 * Kept as a thin wrapper over `ThinkingIndicator` so the primitive's semantics
 * (and every existing `<TypingIndicator label=… />` call site) survive the
 * change from three bouncing dots to a decoding line.
 */
export const TypingIndicator = forwardRef<HTMLDivElement, TypingIndicatorProps>(
  ({ className, label, mark }, ref) => {
    return (
      <TypingIndicatorPrimitive ref={ref} className={cn("inline-flex", className)}>
        <ThinkingIndicator mark={mark} label={label} />
      </TypingIndicatorPrimitive>
    );
  }
);

TypingIndicator.displayName = "TypingIndicator";
