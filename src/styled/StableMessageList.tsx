import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { MessageListProps } from "./MessageList";
import { cn } from "../utils/cn";
import { ScrollToBottomButton } from "./ScrollToBottomButton";

type Mode = "initial" | "anchored" | "reading" | "following";
type Landmark = { id: string; top: number };
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/** One owner for positioning, prepends, and delayed layout. Opt-in so existing
 * package consumers retain the original scroller's contract. */
export const StableMessageList = forwardRef<HTMLDivElement, MessageListProps>(
  function StableMessageList(
    {
      children,
      className,
      autoScroll = true,
      showScrollToBottom = true,
      scrollAnchorId = null,
      scrollPreviousItemPeek = 64,
      history,
    },
    forwardedRef,
  ) {
    const viewport = useRef<HTMLDivElement | null>(null);
    const content = useRef<HTMLDivElement | null>(null);
    const spacer = useRef<HTMLDivElement | null>(null);
    const mode = useRef<Mode>("initial");
    const lastAnchor = useRef<string | null>(null);
    const landmarks = useRef<Landmark[]>([]);
    const expectedTop = useRef(0);
    const [atBottom, setAtBottom] = useState(true);
    const [ready, setReady] = useState(false);
    const props = useRef({
      scrollAnchorId,
      scrollPreviousItemPeek,
      autoScroll,
      history,
    });
    props.current = {
      scrollAnchorId,
      scrollPreviousItemPeek,
      autoScroll,
      history,
    };
    const rows = () =>
      Array.from(
        content.current?.querySelectorAll<HTMLElement>(
          ":scope > [data-message-id]",
        ) ?? [],
      );
    const capture = useCallback(() => {
      const el = viewport.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      landmarks.current = rows()
        .filter((row) => row.getBoundingClientRect().bottom > top)
        .slice(0, 3)
        .map((row) => ({
          id: row.dataset.messageId!,
          top: row.getBoundingClientRect().top - top,
        }));
      expectedTop.current = el.scrollTop;
      setAtBottom(el.scrollHeight - el.clientHeight - el.scrollTop <= 2);
    }, []);

    const correct = useCallback(() => {
      const el = viewport.current;
      const body = content.current;
      const fill = spacer.current;
      if (!el || !body || !fill) return;
      const { scrollAnchorId: anchorId, scrollPreviousItemPeek: peek } =
        props.current;
      const items = rows();
      const anchor = items.find((row) => row.dataset.messageId === anchorId);
      // Keep the same reservation even after manual scrolling or completion.
      // Never let reply shrinkage clamp scrollTop before we can correct it.
      const layout = getComputedStyle(body);
      const paddingTop = parseFloat(layout.paddingTop) || 0;
      const paddingBottom = parseFloat(layout.paddingBottom) || 0;
      const gap = parseFloat(layout.rowGap) || 0;
      const available = Math.max(
        0,
        el.clientHeight - peek - paddingTop - paddingBottom,
      );
      body.style.setProperty("--chat-turn-fill-self", `${available}px`);
      body.style.setProperty(
        "--chat-turn-fill",
        `${Math.max(0, available - gap - (anchor?.offsetHeight ?? 0))}px`,
      );
      if (anchor) {
        const withoutFill = fill.offsetTop - anchor.offsetTop;
        fill.style.height = `${Math.max(0, el.clientHeight - peek - withoutFill - paddingBottom)}px`;
      } else fill.style.height = "0px";

      if (mode.current === "initial")
        mode.current = anchor ? "anchored" : "following";
      const viewportTop = el.getBoundingClientRect().top;
      if (mode.current === "anchored" && anchor) {
        el.scrollTop += anchor.getBoundingClientRect().top - viewportTop - peek;
      } else if (mode.current === "following") {
        el.scrollTop = el.scrollHeight;
      } else {
        const reference = landmarks.current.find((mark) =>
          items.some((row) => row.dataset.messageId === mark.id),
        );
        const row =
          reference &&
          items.find((item) => item.dataset.messageId === reference.id);
        if (row && reference)
          el.scrollTop +=
            row.getBoundingClientRect().top - viewportTop - reference.top;
      }
      capture();
      if (mode.current === "following" && !props.current.autoScroll)
        mode.current = "reading";
    }, [capture]);

    useLayoutEffect(() => {
      if (lastAnchor.current !== scrollAnchorId) {
        if (scrollAnchorId) mode.current = "anchored";
        else if (mode.current === "anchored") mode.current = "reading";
        lastAnchor.current = scrollAnchorId;
      }
      correct();
      setReady(true);
    });

    useLayoutEffect(() => {
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(correct);
      if (viewport.current) observer.observe(viewport.current);
      if (content.current) observer.observe(content.current);
      // Observe individual rows too: two rows can change in opposite directions
      // without changing the overall height of the transcript.
      for (const row of rows()) observer.observe(row);
      return () => observer.disconnect();
    }, [children, correct]);

    const release = () => {
      mode.current = "reading";
      capture();
    };
    const loadHistory = () => {
      const state = props.current.history;
      if (
        viewport.current &&
        viewport.current.scrollTop <= 200 &&
        state?.hasOlder &&
        !state.loading &&
        !state.error
      ) {
        state.onLoadOlder();
      }
    };
    const items = Children.toArray(children).filter(
      (child): child is ReactElement<Record<string, unknown>> =>
        isValidElement(child),
    );
    return (
      <div
        className="relative flex-1 overflow-hidden"
        data-scroll-mode={mode.current}
      >
        <div
          ref={(el) => {
            viewport.current = el;
            if (typeof forwardedRef === "function") forwardedRef(el);
            else if (forwardedRef) forwardedRef.current = el;
          }}
          role="region"
          aria-label="Messages"
          tabIndex={0}
          className="h-full overflow-y-auto chat-scrollbar"
          style={{
            overscrollBehavior: "contain",
            overflowAnchor: "none",
            scrollBehavior: "auto",
            visibility: ready ? "visible" : "hidden",
          }}
          onWheel={(event) => {
            if (event.deltaY) {
              release();
              if (event.deltaY < 0) loadHistory();
            }
          }}
          onTouchMove={release}
          onKeyDown={(event) => {
            if (
              SCROLL_KEYS.has(event.key) &&
              event.target === event.currentTarget
            )
              release();
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) release();
          }}
          onScroll={() => {
            const el = viewport.current!;
            if (Math.abs(el.scrollTop - expectedTop.current) <= 1) return;
            // Also catches assistive technology and scrollbar scrolls.
            mode.current = "reading";
            capture();
            loadHistory();
          }}
        >
          <div
            ref={content}
            role="log"
            aria-relevant="additions text"
            className={cn("relative flex flex-col gap-6 p-4 pb-12", className)}
          >
            {history && (history.hasOlder || history.error) && (
              <div className="text-center text-sm" aria-live="polite">
                {history.loading ? (
                  "Loading earlier messages…"
                ) : history.error ? (
                  <button type="button" onClick={history.onLoadOlder}>
                    Could not load messages. Retry
                  </button>
                ) : (
                  <button type="button" onClick={history.onLoadOlder}>
                    Load earlier messages
                  </button>
                )}
              </div>
            )}
            {items.map((child) => (
              <div
                key={child.key}
                data-message-id={child.props["data-message-id"]}
              >
                {child}
              </div>
            ))}
            <div
              ref={spacer}
              aria-hidden="true"
              style={{ height: 0, marginTop: -24, flexShrink: 0 }}
            />
          </div>
        </div>
        {showScrollToBottom && (
          <ScrollToBottomButton
            isAtBottom={atBottom}
            onScrollToBottom={() => {
              mode.current = "following";
              correct();
            }}
          />
        )}
      </div>
    );
  },
);
