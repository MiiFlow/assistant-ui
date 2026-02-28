import { forwardRef, type ReactNode } from "react";
import { useAutoScroll } from "../hooks/use-auto-scroll";
import { cn } from "../utils/cn";
import { ScrollToBottomButton } from "./ScrollToBottomButton";

export interface MessageListProps {
	/** Messages to render */
	children: ReactNode;
	/** Whether to auto-scroll to bottom */
	autoScroll?: boolean;
	/** Whether to show the scroll-to-bottom button */
	showScrollToBottom?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Styled MessageList with scrolling, spacing, and scroll-to-bottom button.
 * Uses the enhanced useAutoScroll hook directly instead of going through
 * the primitive, since we need reactive isAtBottom for the button.
 */
export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
	({ children, autoScroll = true, showScrollToBottom = true, className }, ref) => {
		const { containerRef, scrollToBottom, isAtBottom } = useAutoScroll<HTMLDivElement>({
			enabled: autoScroll,
		});

		// Merge refs
		const mergedRef = (node: HTMLDivElement | null) => {
			(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
			if (typeof ref === "function") {
				ref(node);
			} else if (ref) {
				ref.current = node;
			}
		};

		return (
			<div className="relative flex-1 overflow-hidden">
				<div
					ref={mergedRef}
					className={cn(
						"h-full overflow-y-auto",
						"flex flex-col gap-4 p-4",
						"chat-scrollbar",
						className,
					)}
				>
					{children}
				</div>
				{showScrollToBottom && (
					<ScrollToBottomButton
						isAtBottom={isAtBottom}
						onScrollToBottom={() => scrollToBottom("smooth")}
					/>
				)}
			</div>
		);
	},
);

MessageList.displayName = "MessageList";
