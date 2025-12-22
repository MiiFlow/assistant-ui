import { cn } from "../utils/cn";

export interface LoadingDotsProps {
  /** Size variant */
  size?: "small" | "medium" | "large";
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  small: "w-1.5 h-1.5",
  medium: "w-2 h-2",
  large: "w-2.5 h-2.5",
};

const gapClasses = {
  small: "gap-1",
  medium: "gap-1.5",
  large: "gap-2",
};

/**
 * Animated loading dots indicator
 */
export function LoadingDots({ size = "medium", className }: LoadingDotsProps) {
  const dotClass = sizeClasses[size];

  return (
    <div className={cn("flex items-center", gapClasses[size], className)}>
      <div
        className={cn(
          dotClass,
          "rounded-full bg-[var(--chat-text-subtle)]",
          "animate-loading-dot animate-loading-dot-1"
        )}
      />
      <div
        className={cn(
          dotClass,
          "rounded-full bg-[var(--chat-text-subtle)]",
          "animate-loading-dot animate-loading-dot-2"
        )}
      />
      <div
        className={cn(
          dotClass,
          "rounded-full bg-[var(--chat-text-subtle)]",
          "animate-loading-dot animate-loading-dot-3"
        )}
      />
    </div>
  );
}
