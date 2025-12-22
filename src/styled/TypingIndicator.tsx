import { forwardRef } from "react";
import { TypingIndicator as TypingIndicatorPrimitive } from "../primitives";
import { cn } from "../utils/cn";

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
          "px-4 py-3 rounded-message",
          "bg-chat-message-bg",
          className
        )}
      >
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "w-2 h-2 rounded-full bg-chat-subtle",
                "animate-typing"
              )}
              style={{
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </span>
      </TypingIndicatorPrimitive>
    );
  }
);

TypingIndicator.displayName = "TypingIndicator";
