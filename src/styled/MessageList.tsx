import {
	Children,
	forwardRef,
	isValidElement,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactElement,
	type ReactNode,
} from "react";
import {
	MessageScroller,
	useMessageScroller,
	useMessageScrollerScrollable,
} from "@shadcn/react/message-scroller";
import { cn } from "../utils/cn";
import { ScrollToBottomButton } from "./ScrollToBottomButton";

export interface MessageListProps {
	/** Messages to render. A direct child carrying `data-message-id` is
	 *  registered with the scroll engine under that id; one also carrying
	 *  `data-scroll-anchor="true"` is a turn anchor (see below). Children
	 *  without either are plain rows. */
	children: ReactNode;
	/** Follow the live edge while the reader is at it. Ignored while a turn is
	 *  anchored — an anchored transcript holds still and grows downward — unless
	 *  the reader asks to follow via the scroll-to-bottom button. */
	autoScroll?: boolean;
	/** Whether to show the scroll-to-bottom button */
	showScrollToBottom?: boolean;
	/** Additional CSS classes applied to the transcript container (e.g. horizontal padding) */
	className?: string;
	/** Pixels of the previous turn left visible above an anchored one. */
	scrollPreviousItemPeek?: number;
	/** Where the transcript opens. `last-anchor` lands the last anchored turn at
	 *  the top when what follows it overflows the viewport, and is the same as
	 *  `end` when no child is an anchor. Must not change between renders. */
	defaultScrollPosition?: "end" | "last-anchor";
}

const MASK = "linear-gradient(to bottom, black 0%, black calc(100% - 20px), transparent 100%)";
const DEFAULT_PEEK = 64;

/** CSS custom properties published on the transcript's content element. */
export const TURN_FILL_VAR = "--chat-turn-fill";
export const TURN_FILL_SELF_VAR = "--chat-turn-fill-self";

/**
 * Reads the engine's scroll state and drives the existing ScrollToBottomButton.
 * Must render inside <MessageScroller.Provider>. `scrollable.end === true` means
 * there is content below the viewport (i.e. not at the bottom).
 */
function ScrollToEndControl({ onFollow }: { onFollow: () => void }) {
	const { end } = useMessageScrollerScrollable();
	const { scrollToEnd } = useMessageScroller();
	return (
		<ScrollToBottomButton
			isAtBottom={!end}
			onScrollToBottom={() => {
				scrollToEnd({ behavior: "smooth" });
				onFollow();
			}}
		/>
	);
}

function readItemProps(child: ReactElement) {
	const props = child.props as Record<string, unknown>;
	const id = props["data-message-id"];
	const anchor = props["data-scroll-anchor"];
	return {
		messageId: typeof id === "string" ? id : undefined,
		anchor: anchor === "true" || anchor === true,
	};
}

/**
 * Publishes the space a live turn may fill, as two pixel custom properties on
 * the content element:
 *
 * - `--chat-turn-fill`: the height the row AFTER the anchor must reach for the
 *   anchor to sit at the top of the viewport with nothing to scroll past;
 * - `--chat-turn-fill-self`: the same, for a row that is itself the anchor.
 *
 * A host puts `min-height: var(--chat-turn-fill)` on the live assistant row.
 * The engine's own spacer already lets the anchor scroll to the top; the row
 * reservation is what keeps it there when the content SHRINKS — a step
 * window folding, an action bar appearing — because in anchored mode the
 * scroll position sits at its maximum, and a shrink would clamp it one frame
 * before the engine re-anchors.
 */
function TurnFill({ liveAnchorId, peek }: { liveAnchorId: string | null; peek: number }) {
	// The engine does not expose its elements. The probe below is rendered
	// inside the ROOT, beside the viewport — never inside the content element:
	// the engine detects a newly appended row by scanning the content's
	// children from the previous count, so a trailing probe there would hide
	// every new row (the anchored user turn included) from it. From the root,
	// the content element is a descendant and the viewport is its parent.
	const contentRef = useRef<HTMLElement | null>(null);
	const setContent = useCallback((el: HTMLElement | null) => {
		contentRef.current = el?.parentElement?.querySelector<HTMLElement>('[role="log"]') ?? null;
	}, []);

	useLayoutEffect(() => {
		const content = contentRef.current;
		const viewport = content?.parentElement ?? null;
		if (!content || !viewport) return;
		const cs = getComputedStyle(content);
		const paddingTop = parseFloat(cs.paddingTop) || 0;
		const paddingBottom = parseFloat(cs.paddingBottom) || 0;
		const gap = parseFloat(cs.rowGap === "normal" ? cs.gap : cs.rowGap) || 0;
		const anchor = liveAnchorId
			? Array.from(content.children).find(
					(el): el is HTMLElement =>
						el instanceof HTMLElement && el.dataset.messageId === liveAnchorId,
				) ?? null
			: null;

		const apply = () => {
			const self = Math.max(0, viewport.clientHeight - paddingTop - peek - paddingBottom);
			const below = Math.max(0, self - (anchor?.offsetHeight ?? 0) - gap);
			content.style.setProperty(TURN_FILL_SELF_VAR, `${self}px`);
			content.style.setProperty(TURN_FILL_VAR, `${below}px`);
		};
		apply();

		if (typeof ResizeObserver === "undefined") return;
		const ro = new ResizeObserver(apply);
		ro.observe(viewport);
		if (anchor) ro.observe(anchor);
		return () => ro.disconnect();
	}, [liveAnchorId, peek]);

	// A zero-size probe, a sibling of the viewport inside the root, so we can
	// find the content element without threading refs through the engine.
	return <span ref={setContent} hidden aria-hidden data-chat-turn-fill-probe="" />;
}

/**
 * Styled MessageList — scroll container for a chat transcript.
 *
 * Scroll behaviour is provided by shadcn's `@shadcn/react` message-scroller
 * engine. Two modes:
 *
 * - **Following** (no anchored child): the transcript follows the live edge
 *   while the reader is at it, as a chat has always done.
 * - **Anchored** (a child carries `data-scroll-anchor="true"`): the anchored
 *   row — the user's latest message, in the usual host — is pinned near the
 *   top of the viewport with a slice of the previous turn peeking above it,
 *   and the answer streams DOWN into reserved space. The viewport does not
 *   move while text arrives; the reader scrolls when they want to, and the
 *   engine releases the anchor on any wheel, touch or keyboard scroll.
 *
 * Anchoring is opt-in per child, so the extension and the embed snippet, which
 * pass plain rows, keep the following behaviour unchanged.
 */
export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
	(
		{
			children,
			autoScroll = true,
			showScrollToBottom = true,
			className,
			scrollPreviousItemPeek = DEFAULT_PEEK,
			defaultScrollPosition = "last-anchor",
		},
		ref,
	) => {
		const items = Children.toArray(children)
			.filter((child): child is ReactElement => isValidElement(child))
			.map((child) => ({ child, ...readItemProps(child) }));
		const liveAnchorId = items.filter((item) => item.anchor).at(-1)?.messageId ?? null;

		// No bottom-follow while a turn is anchored, unless the reader asked for
		// it with the button. A new anchored turn cancels the request.
		const [followRequested, setFollowRequested] = useState(false);
		useEffect(() => {
			setFollowRequested(false);
		}, [liveAnchorId]);
		const engineAutoScroll = autoScroll && (liveAnchorId === null || followRequested);

		// The engine leaves anchored mode on wheel/touch/keys only. A scrollbar
		// drag fires none of those, so the next content resize would re-anchor
		// and yank the reader back. Dispatch a zero-delta wheel event for a
		// pointer-down on the viewport element itself — the gutter is the only
		// part of it a pointer can land on directly.
		const onGutterPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
			if (event.target !== event.currentTarget) return;
			if (typeof WheelEvent === "undefined") return;
			event.currentTarget.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 0 }));
		}, []);

		return (
			<MessageScroller.Provider
				autoScroll={engineAutoScroll}
				defaultScrollPosition={defaultScrollPosition}
				scrollPreviousItemPeek={scrollPreviousItemPeek}
			>
				<MessageScroller.Root
					className="relative flex-1 overflow-hidden"
					style={{ mask: MASK, WebkitMask: MASK }}
				>
					<MessageScroller.Viewport
						ref={ref}
						className="h-full overflow-y-auto chat-scrollbar"
						style={{ overscrollBehavior: "contain" }}
						onPointerDown={onGutterPointerDown}
					>
						{/* gap-6: the largest gap in the transcript must be between turns.
						    At gap-4 it was only double a paragraph gap, and assistant
						    messages have no background to delimit them. */}
						<MessageScroller.Content className={cn("flex flex-col gap-6 p-4 pb-12", className)}>
							{items.map(({ child, messageId, anchor }) => (
								<MessageScroller.Item
									key={child.key ?? undefined}
									messageId={messageId}
									scrollAnchor={anchor}
								>
									{child}
								</MessageScroller.Item>
							))}
						</MessageScroller.Content>
					</MessageScroller.Viewport>
					<TurnFill liveAnchorId={liveAnchorId} peek={scrollPreviousItemPeek} />
					{showScrollToBottom && (
						<ScrollToEndControl onFollow={() => setFollowRequested(true)} />
					)}
				</MessageScroller.Root>
			</MessageScroller.Provider>
		);
	},
);

MessageList.displayName = "MessageList";
