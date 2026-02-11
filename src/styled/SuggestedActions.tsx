import { forwardRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Navigation,
  Copy,
  Mail,
  Search,
  ExternalLink,
  Zap,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { SuggestedAction, SuggestedActionType } from "../types";

export interface SuggestedActionsProps {
  /** List of suggested actions */
  actions: SuggestedAction[];
  /** Callback when an action is selected */
  onSelect?: (action: SuggestedAction) => void | Promise<void>;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show type-specific icons */
  showIcons?: boolean;
  /** Disable all action buttons */
  disabled?: boolean;
}

const ACTION_ICONS: Record<SuggestedActionType, ReactNode> = {
  send_message: <Send size={14} />,
  navigate: <Navigation size={14} />,
  copy_text: <Copy size={14} />,
  compose_email: <Mail size={14} />,
  search_emails: <Search size={14} />,
  open_modal: <ExternalLink size={14} />,
  api_call: <Zap size={14} />,
};

function getActionIcon(type?: SuggestedActionType): ReactNode {
  if (!type) return <ArrowRight size={14} />;
  return ACTION_ICONS[type] || <ArrowRight size={14} />;
}

/**
 * Styled SuggestedActions with type-specific icons, loading states, and staggered animation.
 */
export const SuggestedActions = forwardRef<HTMLDivElement, SuggestedActionsProps>(
  ({ actions, onSelect, className, showIcons = true, disabled = false }, ref) => {
    const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

    if (actions.length === 0) return null;

    const handleAction = async (action: SuggestedAction, index: number) => {
      if (!onSelect || loadingIndex !== null) return;
      setLoadingIndex(index);
      try {
        await onSelect(action);
      } finally {
        setLoadingIndex(null);
      }
    };

    return (
      <div ref={ref} role="group" aria-label="Suggested actions" className={cn("flex flex-wrap gap-2", className)}>
        <AnimatePresence>
          {actions.map((action, i) => {
            const isLoading = loadingIndex === i;
            const isDisabled = disabled || loadingIndex !== null;
            return (
              <motion.button
                key={action.id}
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                disabled={isDisabled}
                onClick={() => handleAction(action, i)}
                className={cn(
                  "inline-flex items-center gap-1.5",
                  "px-3 py-1.5 rounded-lg",
                  "text-sm font-medium",
                  "border border-gray-200 dark:border-gray-700",
                  "bg-white dark:bg-gray-800",
                  "text-gray-700 dark:text-gray-300",
                  "opacity-80 hover:opacity-100",
                  "hover:border-gray-300 dark:hover:border-gray-600",
                  "hover:bg-gray-50 dark:hover:bg-gray-750",
                  "hover:-translate-y-px",
                  "active:translate-y-0",
                  "transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}
              >
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  showIcons && <span className="text-gray-400 dark:text-gray-500">{getActionIcon(action.type)}</span>
                )}
                {action.label}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }
);

SuggestedActions.displayName = "SuggestedActions";
