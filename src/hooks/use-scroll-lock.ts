import { type RefObject, useCallback, useEffect, useRef } from "react";

/**
 * Locks scroll position during collapsible/height animations.
 *
 * Prevents viewport jumps when content height changes during animations
 * (e.g. ReasoningPanel expand/collapse). Finds the nearest scrollable
 * ancestor and temporarily locks its scroll position for the animation duration.
 *
 * Adapted from assistant-ui's useScrollLock.
 *
 * @param animatedElementRef - Ref to the animated element
 * @param animationDuration - Lock duration in milliseconds
 * @returns Function to activate the scroll lock (call before toggling)
 *
 * @example
 * ```tsx
 * const panelRef = useRef<HTMLDivElement>(null);
 * const lockScroll = useScrollLock(panelRef, 200);
 *
 * const handleToggle = () => {
 *   lockScroll();
 *   setIsExpanded(!isExpanded);
 * };
 * ```
 */
export function useScrollLock<T extends HTMLElement = HTMLElement>(
  animatedElementRef: RefObject<T | null>,
  animationDuration: number,
) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const lockScroll = useCallback(() => {
    // Clean up any previous lock
    cleanupRef.current?.();

    // Find nearest scrollable ancestor (cached after first find)
    if (!scrollContainerRef.current && animatedElementRef.current) {
      let el: HTMLElement | null = animatedElementRef.current;
      while (el) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === "scroll" || overflowY === "auto") {
          scrollContainerRef.current = el;
          break;
        }
        el = el.parentElement;
      }
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    // Capture current scroll position
    const scrollPosition = scrollContainer.scrollTop;
    const prevScrollbarWidth = scrollContainer.style.scrollbarWidth;

    // Hide scrollbar during lock to prevent visual jank
    scrollContainer.style.scrollbarWidth = "none";

    // Lock: intercept any scroll events and reset position
    const resetPosition = () => {
      scrollContainer.scrollTop = scrollPosition;
    };
    scrollContainer.addEventListener("scroll", resetPosition);

    // Release lock after animation completes
    const timeoutId = setTimeout(() => {
      scrollContainer.removeEventListener("scroll", resetPosition);
      scrollContainer.style.scrollbarWidth = prevScrollbarWidth;
      cleanupRef.current = null;
    }, animationDuration);

    cleanupRef.current = () => {
      clearTimeout(timeoutId);
      scrollContainer.removeEventListener("scroll", resetPosition);
      scrollContainer.style.scrollbarWidth = prevScrollbarWidth;
    };
  }, [animationDuration, animatedElementRef]);

  return lockScroll;
}
