import { Children, forwardRef, isValidElement, type ReactNode } from "react";
import {
	MessageScroller,
	useMessageScroller,
	useMessageScrollerScrollable,
} from "@shadcn/react/message-scroller";
import { cn } from "../utils/cn";
import { ScrollToBottomButton } from "./ScrollToBottomButton";

export interface MessageListProps {
	/** Messages to render */
	children: ReactNode;
	/** Whether to auto-scroll to bottom while streaming (follows only when at the live edge) */
	autoScroll?: boolean;
	/** Whether to show the scroll-to-bottom button */
	showScrollToBottom?: boolean;
	/** Additional CSS classes applied to the transcript container (e.g. horizontal padding) */
	className?: string;
}

const MASK = "linear-gradient(to bottom, black 0%, black calc(100% - 20px), transparent 100%)";

/**
 * Reads the engine's scroll state and drives the existing ScrollToBottomButton.
 * Must render inside <MessageScroller.Provider>. `scrollable.end === true` means
 * there is content below the viewport (i.e. not at the bottom).
 */
function ScrollToEndControl() {
	const { end } = useMessageScrollerScrollable();
	const { scrollToEnd } = useMessageScroller();
	return (
		<ScrollToBottomButton
			isAtBottom={!end}
			onScrollToBottom={() => scrollToEnd({ behavior: "smooth" })}
		/>
	);
}

/**
 * Styled MessageList — scroll container for a chat transcript.
 *
 * Scroll behavior is provided by shadcn's `@shadcn/react` message-scroller
 * engine (auto-follow while at the live edge, position preservation, scroll
 * anchoring) rather than the legacy `useAutoScroll` hook. The public API is
 * unchanged: pass message rows as `children`; each direct child is wrapped in a
 * `MessageScroller.Item` for measurement and anchoring.
 */
export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
	({ children, autoScroll = true, showScrollToBottom = true, className }, ref) => {
		return (
			<MessageScroller.Provider autoScroll={autoScroll} defaultScrollPosition="end">
				<MessageScroller.Root
					className="relative flex-1 overflow-hidden"
					style={{ mask: MASK, WebkitMask: MASK }}
				>
					<MessageScroller.Viewport
						ref={ref}
						className="h-full overflow-y-auto chat-scrollbar"
						style={{ overscrollBehavior: "contain" }}
					>
						<MessageScroller.Content className={cn("flex flex-col gap-4 p-4 pb-12", className)}>
							{Children.map(children, (child) =>
								isValidElement(child) ? (
									<MessageScroller.Item>{child}</MessageScroller.Item>
								) : (
									child
								),
							)}
						</MessageScroller.Content>
					</MessageScroller.Viewport>
					{showScrollToBottom && <ScrollToEndControl />}
				</MessageScroller.Root>
			</MessageScroller.Provider>
		);
	},
);

MessageList.displayName = "MessageList";
