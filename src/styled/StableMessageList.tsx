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
import { glideOffPath, readScroll } from "./scroll-rules";

type Mode = "initial" | "anchored" | "reading" | "following";
type Landmark = { id: string; top: number };
/** A programmatic smooth scroll in flight: where it is heading, and the last
 *  position it was seen at (a glide only moves from there toward `target`). */
type Glide = { target: number; from: number };
const SCROLL_KEYS: Record<string, "up" | "down"> = {
  ArrowUp: "up",
  PageUp: "up",
  Home: "up",
  ArrowDown: "down",
  PageDown: "down",
  End: "down",
  " ": "down",
};
// Quiet time after the last glide frame that counts as "the glide stopped",
// for browsers without `scrollend` (and as a backstop for a stalled glide).
// The first frame can take longer to arrive.
const GLIDE_SETTLE_MS = 150;
const GLIDE_START_MS = 300;

const prefers = (query: string) =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(query).matches;

/** One owner for positioning, prepends, and delayed layout. Opt-in so existing
 * package consumers retain the original scroller's contract.
 *
 * Modes: `anchored` holds a just-sent message near the top while its reply
 * grows below; `reading` keeps whatever the reader is looking at in place;
 * `following` sticks to the bottom. A send glides to its anchor. The reader
 * scrolling releases the hold, and reaching the bottom resumes following once
 * the reply has outgrown the screen (see `readScroll`). */
export const StableMessageList = forwardRef<HTMLDivElement, MessageListProps>(
  function StableMessageList(
    {
      children,
      className,
      autoScroll = true,
      showScrollToBottom = true,
      scrollAnchorId = null,
      scrollPreviousItemPeek,
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
    const glide = useRef<Glide | null>(null);
    // Set when the next positioning should glide rather than jump: a send, or
    // the jump-to-latest button.
    const glideNext = useRef(false);
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchY = useRef<number | null>(null);
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
      setAtBottom(readScroll(el, null).atEdge);
    }, []);

    // The gap left above a pinned message. Defaults to the transcript's own
    // top padding, so a sent question sits where a conversation's first
    // message does rather than under a sliver of the previous turn.
    const pinGap = () => {
      const body = content.current;
      const explicit = props.current.scrollPreviousItemPeek;
      if (explicit !== undefined || !body) return explicit ?? 0;
      return parseFloat(getComputedStyle(body).paddingTop) || 0;
    };

    // The scroll offset at which the anchor sits at its pin, or null.
    const pinTop = () => {
      const el = viewport.current;
      const anchorId = props.current.scrollAnchorId;
      const anchor =
        anchorId && rows().find((row) => row.dataset.messageId === anchorId);
      if (!el || !anchor) return null;
      return (
        anchor.getBoundingClientRect().top -
        el.getBoundingClientRect().top +
        el.scrollTop -
        pinGap()
      );
    };

    const endGlide = () => {
      glide.current = null;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = null;
    };

    // After the reader moved the viewport: follow from the bottom (once any
    // pinned reply has outgrown the screen), otherwise hold their place.
    const settleFromPosition = () => {
      const el = viewport.current;
      if (!el) return;
      const { follow } = readScroll(el, pinTop());
      mode.current = follow && props.current.autoScroll ? "following" : "reading";
      capture();
    };

    const correct = useCallback(() => {
      const el = viewport.current;
      const body = content.current;
      const fill = spacer.current;
      if (!el || !body || !fill) return;
      const anchorId = props.current.scrollAnchorId;
      const peek = pinGap();
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
      const bottom = Math.max(0, el.scrollHeight - el.clientHeight);
      const target =
        mode.current === "anchored" && anchor
          ? Math.min(
              bottom,
              Math.max(
                0,
                el.scrollTop + anchor.getBoundingClientRect().top - viewportTop - peek,
              ),
            )
          : mode.current === "following"
            ? bottom
            : null;
      if (target !== null) {
        const smooth = glideNext.current || glide.current !== null;
        glideNext.current = false;
        if (!smooth || prefers("(prefers-reduced-motion: reduce)")) {
          endGlide();
          el.scrollTop = target;
        } else if (
          Math.abs(target - el.scrollTop) > 1 &&
          (!glide.current || Math.abs(target - glide.current.target) > 1)
        ) {
          // Start, or re-aim when the destination moved (content above the
          // anchor changed size, or the bottom moved while following). Never
          // assign scrollTop mid-glide: that would cancel the animation.
          glide.current = { target, from: el.scrollTop };
          el.scrollTo({ top: target, behavior: "smooth" });
          armSettle(GLIDE_START_MS);
        } else if (!glide.current) {
          el.scrollTop = target;
        }
      } else {
        endGlide();
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
      if (!glide.current) capture();
      if (mode.current === "following" && !props.current.autoScroll)
        mode.current = "reading";
      // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read refs only
    }, [capture]);

    // The glide stopped. Short of its target with no gesture from the reader
    // (those end the glide in `release`), it was stalled, not taken over.
    // Either way, finish where the current mode points now: exactly, since a
    // glide can come to rest a fraction of a pixel away.
    const settleGlide = () => {
      if (!glide.current) return;
      endGlide();
      correct();
    };
    function armSettle(ms: number) {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(settleGlide, ms);
    }

    useLayoutEffect(() => {
      if (lastAnchor.current !== scrollAnchorId) {
        if (scrollAnchorId) {
          // The first layout is hidden until positioned; jump there.
          if (ready) glideNext.current = true;
          mode.current = "anchored";
        } else if (mode.current === "anchored") mode.current = "reading";
        lastAnchor.current = scrollAnchorId;
      }
      correct();
      setReady(true);
    });

    useLayoutEffect(() => {
      const el = viewport.current;
      if (!el) return;
      el.addEventListener("scrollend", settleGlide);
      return () => {
        el.removeEventListener("scrollend", settleGlide);
        if (settleTimer.current) clearTimeout(settleTimer.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- helpers read refs only
    }, []);

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

    // The reader started scrolling. Releasing before the scroll lands keeps a
    // resize correction from snapping them back mid-gesture; scrolling down
    // while following is the one gesture that cannot need releasing.
    const release = (direction: "up" | "down" | "unknown" = "unknown") => {
      endGlide();
      if (direction === "down" && mode.current === "following") return;
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
              release(event.deltaY < 0 ? "up" : "down");
              if (event.deltaY < 0) loadHistory();
            }
          }}
          onTouchStart={(event) => {
            touchY.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchMove={(event) => {
            const y = event.touches[0]?.clientY;
            const previous = touchY.current;
            touchY.current = y ?? null;
            // A finger moving up scrolls the transcript down.
            release(
              y === undefined || previous === null || y === previous
                ? "unknown"
                : y < previous
                  ? "down"
                  : "up",
            );
          }}
          onKeyDown={(event) => {
            const direction = SCROLL_KEYS[event.key];
            if (direction && event.target === event.currentTarget)
              release(event.key === " " && event.shiftKey ? "up" : direction);
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) release();
          }}
          onPointerUp={(event) => {
            // A scrollbar press that ended at the bottom resumes following.
            if (event.target === event.currentTarget) settleFromPosition();
          }}
          onScroll={() => {
            const el = viewport.current!;
            const current = glide.current;
            if (current) {
              if (
                glideOffPath({
                  from: current.from,
                  target: current.target,
                  scrollTop: el.scrollTop,
                })
              ) {
                endGlide();
                settleFromPosition();
              } else if (Math.abs(el.scrollTop - current.target) <= 1) {
                settleGlide();
              } else {
                current.from = el.scrollTop;
                armSettle(GLIDE_SETTLE_MS);
              }
              return;
            }
            if (Math.abs(el.scrollTop - expectedTop.current) <= 1) return;
            // Also catches assistive technology and scrollbar scrolls.
            settleFromPosition();
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
            label="Jump to latest"
            isAtBottom={atBottom}
            onScrollToBottom={() => {
              mode.current = "following";
              glideNext.current = true;
              correct();
            }}
          />
        )}
      </div>
    );
  },
);
