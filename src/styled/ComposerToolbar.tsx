import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

const GHOST_BUTTON = cn(
	"flex-shrink-0 rounded-lg flex items-center justify-center",
	"text-[var(--chat-text-subtle,rgba(0,0,0,0.5))]",
	"hover:bg-[var(--chat-panel-bg,rgba(0,0,0,0.02))] hover:text-[var(--chat-text,#1d2033)]",
	"disabled:opacity-40 disabled:cursor-not-allowed",
	"transition-colors duration-150",
);

/**
 * Bottom toolbar row for composers: attach button, an Enter-to-send hint that
 * fades in while the composer is focused (requires `group` on the shell), and
 * a trailing slot for the send/stop button.
 */
export function ComposerToolbar({
	onAttachClick,
	disabled,
	hint = "Enter to send",
	showHint = true,
	endSlot,
	className,
}: {
	/** Renders the "+" attach button when provided. */
	onAttachClick?: () => void;
	disabled?: boolean;
	/** Keyboard hint shown while focused. Pass showHint={false} to hide. */
	hint?: string;
	showHint?: boolean;
	/** Send / stop button. */
	endSlot?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex items-center gap-1 min-w-0", className)}>
			{onAttachClick && (
				<button
					type="button"
					title="Attach files"
					aria-label="Attach files"
					onClick={onAttachClick}
					disabled={disabled}
					className={cn(GHOST_BUTTON, "w-7 h-7")}>
					<Plus size={16} />
				</button>
			)}

			<div className="flex-1 min-w-0" />

			{showHint && (
				<span
					className={cn(
						"hidden sm:block flex-shrink-0 mr-1.5 text-[11px] select-none",
						"text-[var(--chat-placeholder,rgba(0,0,0,0.4))]",
						"opacity-0 group-focus-within:opacity-100 transition-opacity duration-200",
					)}>
					{hint}
				</span>
			)}

			{endSlot}
		</div>
	);
}
