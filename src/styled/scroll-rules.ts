/** How close to the bottom counts as "at the live edge". */
export const EDGE_PX = 24;

/** The scroll geometry a decision reads; a scrolling element satisfies it. */
export type ScrollBox = Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">;

/**
 * Where the reader is after scrolling, and whether the transcript follows new
 * output from here.
 *
 * Sending pins the question near the top and holds it while the answer
 * streams in below. `pinTop` is the scroll offset of that pin, or null when
 * nothing is pinned. The hold ends only at the bottom of an answer that has
 * outgrown the screen. While the answer still fits, the bottom *is* the pin,
 * so following it would mean nothing and would drag the question away as soon
 * as the answer grows. Once the answer is longer, a reader who has scrolled
 * all the way down has caught up, and from there the transcript follows new
 * output. With no pin, reaching the bottom always resumes following.
 */
export function readScroll(
  { scrollTop, scrollHeight, clientHeight }: ScrollBox,
  pinTop: number | null,
): { atEdge: boolean; follow: boolean } {
  const atEdge = scrollHeight - scrollTop - clientHeight <= EDGE_PX;
  const outgrown = pinTop === null || scrollHeight - clientHeight > pinTop + EDGE_PX;
  return { atEdge, follow: atEdge && outgrown };
}

/**
 * Whether the viewport left the path of a programmatic smooth scroll toward
 * `target`. A glide moves monotonically from where it was last seen (`from`)
 * toward its target, so a position outside that range can only come from
 * something else scrolling the viewport. Stopping short on the path is not a
 * takeover: a busy main thread stalls a glide without the reader doing
 * anything, and the reader's own gestures are caught where they happen.
 */
export function glideOffPath({
  from,
  target,
  scrollTop,
}: {
  from: number;
  target: number;
  scrollTop: number;
}): boolean {
  const low = Math.min(from, target) - 1;
  const high = Math.max(from, target) + 1;
  return scrollTop < low || scrollTop > high;
}
