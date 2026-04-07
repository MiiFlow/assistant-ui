/**
 * Reserves vertical space for a streaming assistant message body so the
 * scroll position doesn't jitter as tokens arrive. Measures the accumulated
 * text off-DOM via `@chenglou/pretext` and returns a `minHeight` value to
 * apply to the bubble container.
 *
 * Bails out (returns `undefined`) for content we can't measure cheaply:
 * code blocks, inline markers ([VIZ:], [SA:], [MEDIA:]), and images.
 */

import { useEffect, useState, type RefObject } from "react";
import { measureMessageHeight } from "../utils/measureMessage";

const UNMEASURABLE_PATTERNS = [
	/```/, // fenced code blocks
	/\[VIZ:/,
	/\[SA:/,
	/\[MEDIA:/,
	/!\[/, // markdown images
	/<img\b/i,
];

function isMeasurable(text: string): boolean {
	for (const re of UNMEASURABLE_PATTERNS) {
		if (re.test(text)) return false;
	}
	return true;
}

export function useStreamingMinHeight(
	containerRef: RefObject<HTMLElement | null>,
	text: string | undefined,
	isStreaming: boolean,
): number | undefined {
	const [minHeight, setMinHeight] = useState<number | undefined>(undefined);

	useEffect(() => {
		if (!isStreaming) {
			setMinHeight(undefined);
			return;
		}
		const el = containerRef.current;
		if (!el || !text || !isMeasurable(text)) return;

		let cancelled = false;
		const measure = () => {
			if (cancelled) return;
			const width = el.clientWidth;
			if (width <= 0) return;
			const result = measureMessageHeight(text, width);
			if (!result) return;
			// Monotonic: never shrink while streaming.
			setMinHeight((prev) =>
				prev === undefined || result.height > prev ? result.height : prev,
			);
		};

		measure();

		const ro =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
		ro?.observe(el);

		return () => {
			cancelled = true;
			ro?.disconnect();
		};
	}, [containerRef, text, isStreaming]);

	return minHeight;
}
