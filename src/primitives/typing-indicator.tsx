import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface TypingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  /** Custom content to show while typing */
  children?: ReactNode;
  /** Number of dots to show */
  dotCount?: number;
}

/**
 * Headless TypingIndicator primitive.
 * Shows animated dots or custom content.
 */
export const TypingIndicator = forwardRef<HTMLDivElement, TypingIndicatorProps>(
  ({ children, dotCount = 3, ...props }, ref) => {
    return (
      <div ref={ref} role="status" aria-label="Assistant is typing" {...props}>
        {children ?? (
          <span aria-hidden="true">
            {Array.from({ length: dotCount }).map((_, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "currentColor",
                  marginRight: i < dotCount - 1 ? "4px" : 0,
                  animation: `typing 1.4s infinite ease-in-out`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </span>
        )}
      </div>
    );
  }
);

TypingIndicator.displayName = "TypingIndicator";
