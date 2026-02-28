import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { useAutoScroll } from "../hooks/use-auto-scroll";

export interface MessageListProps extends HTMLAttributes<HTMLDivElement> {
	/** Messages to render */
	children: ReactNode;
	/** Whether to auto-scroll to bottom on new messages */
	autoScroll?: boolean;
	/** Whether the viewport is currently at the bottom (exposed for scroll-to-bottom button) */
	isAtBottom?: boolean;
	/** Callback to receive scroll state updates */
	onIsAtBottomChange?: (isAtBottom: boolean) => void;
	/** Callback to receive scrollToBottom function */
	onScrollToBottomRef?: (scrollToBottom: (behavior?: ScrollBehavior) => void) => void;
}

/**
 * Headless MessageList primitive.
 * Provides a scrollable container with auto-scroll behavior.
 * Exposes isAtBottom and scrollToBottom for scroll-to-bottom button integration.
 */
export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
	({ children, autoScroll = true, onIsAtBottomChange, onScrollToBottomRef, ...props }, ref) => {
		const { containerRef, scrollToBottom, isAtBottom } = useAutoScroll<HTMLDivElement>({
			enabled: autoScroll,
		});

		// Notify parent of scroll state changes
		const prevIsAtBottomRef = { current: isAtBottom };
		if (prevIsAtBottomRef.current !== isAtBottom) {
			onIsAtBottomChange?.(isAtBottom);
		}

		// Expose scrollToBottom to parent
		onScrollToBottomRef?.(scrollToBottom);

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
			<div ref={mergedRef} {...props}>
				{children}
			</div>
		);
	},
);

MessageList.displayName = "MessageList";
