import { useEffect, useRef, useCallback } from "react";

interface UseAutoScrollOptions {
  /** Whether auto-scroll is enabled */
  enabled?: boolean;
  /** Threshold from bottom to trigger auto-scroll (pixels) */
  threshold?: number;
  /** Smooth scroll behavior */
  smooth?: boolean;
}

/**
 * Hook to automatically scroll to the bottom of a container
 * when new content is added, unless the user has scrolled up.
 */
export function useAutoScroll<T extends HTMLElement>({
  enabled = true,
  threshold = 100,
  smooth = true,
}: UseAutoScrollOptions = {}) {
  const containerRef = useRef<T>(null);
  const shouldScrollRef = useRef(true);

  // Track if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // User is near bottom, enable auto-scroll
    shouldScrollRef.current = distanceFromBottom <= threshold;
  }, [threshold]);

  // Scroll to bottom
  const scrollToBottom = useCallback(
    (force = false) => {
      const container = containerRef.current;
      if (!container) return;

      if (force || shouldScrollRef.current) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    },
    [smooth]
  );

  // Auto-scroll when enabled changes or container updates
  useEffect(() => {
    if (enabled) {
      scrollToBottom();
    }
  }, [enabled, scrollToBottom]);

  // Watch for DOM mutations (new messages, streaming content)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const observer = new MutationObserver(() => {
      scrollToBottom();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [enabled, scrollToBottom]);

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return {
    containerRef,
    scrollToBottom,
    isAtBottom: shouldScrollRef.current,
  };
}
