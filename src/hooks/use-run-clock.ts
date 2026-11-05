import { useEffect, useRef, useState } from "react";

/**
 * Elapsed time of a streaming run: `liveSeconds` ticks while it streams,
 * `finalSeconds` is the total once it stops.
 *
 * `startedAt` (epoch ms) is the run's own start, supplied by the host from a
 * durable source. It is preferred over this instance's clock because a
 * transcript remounts whenever the reader navigates away from a thread and
 * back: timing from mount restarts the counter at 0 while the run is minutes
 * old. The local start covers hosts that don't track one.
 *
 * Both starts live in refs written by effects, never during render.
 * `finalSeconds` is state: the completion render happens before the effect
 * that computes it, so a ref would never surface.
 */
export function useRunClock(
	isStreaming: boolean,
	startedAt?: number,
): { liveSeconds: number; finalSeconds: number } {
	const durableStart = startedAt && startedAt > 0 ? startedAt : null;
	const localStartRef = useRef<number | null>(null);
	const durableStartRef = useRef<number | null>(null);
	const [liveSeconds, setLiveSeconds] = useState(0);
	const [finalSeconds, setFinalSeconds] = useState(0);

	// Remembered because the host may drop the run start in the same commit the
	// run completes — the final figure below still needs it. Declared before the
	// completion effect so it runs first.
	useEffect(() => {
		if (durableStart !== null) durableStartRef.current = durableStart;
	}, [durableStart]);

	useEffect(() => {
		if (!isStreaming) return;
		if (localStartRef.current === null) localStartRef.current = Date.now();
		const start = durableStart ?? localStartRef.current;
		// Clamp: a durable start comes from the server, so a client clock running
		// behind it must not render a negative figure.
		const tick = () => setLiveSeconds(Math.max(0, (Date.now() - start) / 1000));
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	}, [isStreaming, durableStart]);

	useEffect(() => {
		if (isStreaming || localStartRef.current === null) return;
		// Streaming just ended — capture the final elapsed time.
		const start = durableStartRef.current ?? localStartRef.current;
		setFinalSeconds(Math.max(0, (Date.now() - start) / 1000));
		// Consumed: a later run in this same instance must not reuse either start.
		localStartRef.current = null;
		durableStartRef.current = null;
	}, [isStreaming, durableStart]);

	return { liveSeconds, finalSeconds };
}
