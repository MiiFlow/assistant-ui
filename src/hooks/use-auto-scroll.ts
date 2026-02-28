import { useEffect, useRef, useCallback, useState } from "react";

export interface UseAutoScrollOptions {
  /** Whether auto-scroll is enabled */
  enabled?: boolean;
  /** Smooth scroll behavior */
  smooth?: boolean;
  /** Scroll to bottom when component mounts */
  scrollToBottomOnMount?: boolean;
}

export interface UseAutoScrollReturn<T extends HTMLElement> {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<T | null>;
  /** Scroll to bottom programmatically (always forces scroll) */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Whether the viewport is currently at the bottom */
  isAtBottom: boolean;
}

/**
 * Hook to automatically scroll to the bottom of a container
 * when new content is added, unless the user has scrolled up.
 *
 * Combines ResizeObserver + MutationObserver to catch all height changes
 * (image loads, panel expansion, streaming text, new messages).
 *
 * Uses a 1px tolerance for isAtBottom (matches assistant-ui) and
 * persists scroll behavior across content resize to prevent
 * the "content outraces scroll" bug.
 */
export function useAutoScroll<T extends HTMLElement>({
  enabled = true,
  smooth = true,
  scrollToBottomOnMount = true,
}: UseAutoScrollOptions = {}): UseAutoScrollReturn<T> {
  const containerRef = useRef<T>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const lastScrollTopRef = useRef(0);

  // When scrollToBottom() is called, store the behavior.
  // On subsequent resize/mutation callbacks, re-scroll with the same behavior
  // until the bottom is actually reached. This prevents the "content outraces
  // scroll" bug where new content pushes the bottom away faster than smooth
  // scrolling can reach it.
  const scrollingToBottomBehaviorRef = useRef<ScrollBehavior | null>(null);

  const scrollToBottom = useCallback(
    (behavior?: ScrollBehavior) => {
      const container = containerRef.current;
      if (!container) return;

      const b = behavior ?? (smooth ? "smooth" : "instant");
      scrollingToBottomBehaviorRef.current = b;
      container.scrollTo({ top: container.scrollHeight, behavior: b });
    },
    [smooth],
  );

  // Determine if we're at the bottom (1px tolerance, or content fits without scroll)
  const computeIsAtBottom = useCallback((el: HTMLElement): boolean => {
    return (
      Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 1 ||
      el.scrollHeight <= el.clientHeight
    );
  }, []);

  // Scroll event handler — updates isAtBottom state
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const newIsAtBottom = computeIsAtBottom(container);

    // If user is scrolling UP while we're in the middle of a scrollToBottom,
    // don't flip isAtBottom to false (ignore scroll-down momentum).
    if (!newIsAtBottom && lastScrollTopRef.current < container.scrollTop) {
      // Scroll is moving down — likely from our scrollToBottom call, ignore
    } else {
      if (newIsAtBottom) {
        scrollingToBottomBehaviorRef.current = null;
      }

      // Only update state when behavior ref is cleared (i.e. not mid-scroll)
      // or when we actually reached the bottom
      const shouldUpdate =
        newIsAtBottom || scrollingToBottomBehaviorRef.current === null;

      if (shouldUpdate) {
        setIsAtBottom(newIsAtBottom);
      }
    }

    lastScrollTopRef.current = container.scrollTop;
  }, [computeIsAtBottom]);

  // Content resize handler — called by both ResizeObserver and MutationObserver
  const handleContentResize = useCallback(() => {
    const scrollBehavior = scrollingToBottomBehaviorRef.current;
    if (scrollBehavior) {
      // We're in the middle of a scrollToBottom — keep chasing the bottom
      scrollToBottom(scrollBehavior);
    } else if (enabled) {
      // Auto-scroll only if already at bottom
      const container = containerRef.current;
      if (container && computeIsAtBottom(container)) {
        scrollToBottom("instant");
      }
    }

    handleScroll();
  }, [enabled, scrollToBottom, computeIsAtBottom, handleScroll]);

  // ResizeObserver — catches height changes from image loads, layout shifts, etc.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const resizeObserver = new ResizeObserver(() => {
      handleContentResize();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [enabled, handleContentResize]);

  // MutationObserver — catches new messages, streaming text, DOM changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const mutationObserver = new MutationObserver((mutations) => {
      // Filter out style-only attribute mutations to prevent feedback loops
      // (e.g. components that write styles in response to viewport changes)
      const hasRelevantMutation = mutations.some(
        (m) => m.type !== "attributes" || m.attributeName !== "style",
      );
      if (hasRelevantMutation) {
        handleContentResize();
      }
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    return () => mutationObserver.disconnect();
  }, [enabled, handleContentResize]);

  // Scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Scroll to bottom on mount
  useEffect(() => {
    if (enabled && scrollToBottomOnMount) {
      // Use instant on mount — no need for smooth animation on initial load
      scrollingToBottomBehaviorRef.current = "instant";
      requestAnimationFrame(() => {
        scrollToBottom("instant");
      });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    containerRef,
    scrollToBottom,
    isAtBottom,
  };
}
