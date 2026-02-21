import { forwardRef } from "react";
import { TypingIndicator as TypingIndicatorPrimitive } from "../primitives";
import { cn } from "../utils/cn";
import { LoadingDots } from "./LoadingDots";

export interface TypingIndicatorProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Styled TypingIndicator with animated dots.
 */
export const TypingIndicator = forwardRef<HTMLDivElement, TypingIndicatorProps>(
  ({ className }, ref) => {
    return (
      <TypingIndicatorPrimitive
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1",
          "px-4 py-3",
          className
        )}
      >
        <LoadingDots size="small" />
      </TypingIndicatorPrimitive>
    );
  }
);

TypingIndicator.displayName = "TypingIndicator";
