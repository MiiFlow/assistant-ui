import {
  createContext,
  useContext,
  forwardRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import type { SuggestedAction } from "../types";

interface SuggestedActionsContextValue {
  actions: SuggestedAction[];
  onSelect: (action: SuggestedAction) => void;
}

const SuggestedActionsContext = createContext<SuggestedActionsContextValue | null>(null);

/**
 * Hook to access suggested actions context.
 */
export function useSuggestedActions() {
  const context = useContext(SuggestedActionsContext);
  if (!context) {
    throw new Error(
      "useSuggestedActions must be used within a SuggestedActions component"
    );
  }
  return context;
}

export interface SuggestedActionsProps {
  /** List of suggested actions */
  actions: SuggestedAction[];
  /** Callback when an action is selected */
  onSelect: (action: SuggestedAction) => void;
  /** Children to render */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Headless SuggestedActions primitive.
 * Provides context for rendering action buttons.
 */
export const SuggestedActions = forwardRef<HTMLDivElement, SuggestedActionsProps>(
  ({ actions, onSelect, children, className }, ref) => {
    if (actions.length === 0) {
      return null;
    }

    return (
      <SuggestedActionsContext.Provider value={{ actions, onSelect }}>
        <div ref={ref} role="group" aria-label="Suggested actions" className={className}>
          {children}
        </div>
      </SuggestedActionsContext.Provider>
    );
  }
);

SuggestedActions.displayName = "SuggestedActions";

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The action this button represents */
  action: SuggestedAction;
  /** Children to render inside button */
  children?: ReactNode;
}

/**
 * Button for a suggested action.
 */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ action, children, onClick, ...props }, ref) => {
    const { onSelect } = useSuggestedActions();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (!e.defaultPrevented) {
        onSelect(action);
      }
    };

    return (
      <button ref={ref} type="button" onClick={handleClick} {...props}>
        {children ?? action.label}
      </button>
    );
  }
);

ActionButton.displayName = "ActionButton";

export { SuggestedActionsContext };
