export interface TimeMarkerProps {
  /** The label to display (e.g. "Today", "Yesterday", "Monday") */
  label: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Centered time separator between message groups.
 * Displays a label like "Today" or "Yesterday" with horizontal rules.
 */
export function TimeMarker({ label, className }: TimeMarkerProps) {
  return (
    <div
      className={`flex items-center gap-3 py-6 select-none ${className ?? ""}`}
      role="separator"
    >
      <div className="flex-1 h-px bg-[var(--chat-border)]" />
      <span className="text-xs font-medium text-[var(--chat-text-subtle)] whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--chat-border)]" />
    </div>
  );
}
