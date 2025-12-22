import { forwardRef } from "react";
import {
  SuggestedActions as SuggestedActionsPrimitive,
  ActionButton as ActionButtonPrimitive,
} from "../primitives";
import { cn } from "../utils/cn";
import type { SuggestedAction } from "../types";

export interface SuggestedActionsProps {
  /** List of suggested actions */
  actions: SuggestedAction[];
  /** Callback when an action is selected */
  onSelect?: (action: SuggestedAction) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Styled SuggestedActions with chip-style buttons.
 */
export const SuggestedActions = forwardRef<HTMLDivElement, SuggestedActionsProps>(
  ({ actions, onSelect, className }, ref) => {
    if (actions.length === 0) {
      return null;
    }

    const handleSelect = onSelect || (() => {});

    return (
      <SuggestedActionsPrimitive
        ref={ref}
        actions={actions}
        onSelect={handleSelect}
        className={cn("flex flex-wrap gap-2", className)}
      >
        {actions.map((action) => (
          <ActionButtonPrimitive
            key={action.id}
            action={action}
            className={cn(
              "px-3 py-1.5 rounded-button",
              "text-sm font-medium",
              "border border-chat-border",
              "bg-white dark:bg-gray-800",
              "text-chat-text",
              "hover:border-chat-border-hover hover:bg-chat-panel-bg",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/20"
            )}
          />
        ))}
      </SuggestedActionsPrimitive>
    );
  }
);

SuggestedActions.displayName = "SuggestedActions";
