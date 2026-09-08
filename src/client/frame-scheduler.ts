/**
 * Coalesce many "state changed" signals into one commit per animation frame.
 *
 * The assistant stream delivers one frame per model token, and every frame
 * used to become its own React commit: parse, reconcile, layout, paint, for
 * one word. Batching the commits to the display's refresh rate costs nothing
 * a reader can see — a frame that arrives 4ms after the last is painted at
 * the same instant either way — and removes the per-token layout thrash.
 *
 * Ordering is preserved by construction. The stream loop applies every frame
 * to its local accumulators synchronously, in arrival order; a commit is a
 * snapshot of all of them. So a tool frame, a retraction and the text around
 * them can never be reordered relative to one another: they are either all in
 * a commit or none of them are.
 */

/** Schedule `cb` for later; returns a function that cancels it. */
export type ScheduleFn = (cb: () => void) => () => void;

/** The default: one commit per animation frame, `setTimeout(0)` off-DOM. */
export const scheduleAnimationFrame: ScheduleFn = (cb) => {
	if (typeof requestAnimationFrame === "function") {
		const id = requestAnimationFrame(() => cb());
		return () => cancelAnimationFrame(id);
	}
	const id = setTimeout(cb, 0);
	return () => clearTimeout(id);
};

/**
 * Test seam: commit on every request. Lets a test that pins "one update per
 * frame" keep observing the un-batched sequence.
 */
export const scheduleSync: ScheduleFn = (cb) => {
	cb();
	return () => {};
};

/**
 * Test seam: a scheduler the test fires by hand, standing in for
 * requestAnimationFrame. `fire()` runs everything queued, in order.
 */
export function createManualScheduler(): { schedule: ScheduleFn; fire: () => void; queued: number } {
	const queue: Array<() => void> = [];
	const handle = {
		schedule: ((cb) => {
			queue.push(cb);
			return () => {
				const i = queue.indexOf(cb);
				if (i >= 0) queue.splice(i, 1);
			};
		}) as ScheduleFn,
		fire() {
			queue.splice(0).forEach((cb) => cb());
		},
		get queued() {
			return queue.length;
		},
	};
	return handle;
}

export interface CommitScheduler {
	/** Ask for one commit on the next tick; idempotent within a tick. */
	request(): void;
	/** Commit now if a request is pending. Use before a side effect that must
	 *  observe the latest state (completion, an interrupt, a status line). */
	flushNow(): void;
	/** Cancel anything pending; further requests are ignored. */
	dispose(): void;
	/** Whether a request is pending. */
	readonly pending: boolean;
}

export function createCommitScheduler(
	commit: () => void,
	schedule: ScheduleFn = scheduleAnimationFrame,
): CommitScheduler {
	let cancel: (() => void) | null = null;
	let disposed = false;

	const run = () => {
		cancel = null;
		if (!disposed) commit();
	};

	return {
		request() {
			if (disposed || cancel) return;
			// A synchronous scheduler (the test seam) runs `run` before returning
			// its cancel handle; that handle must not then be recorded as a
			// pending request, or the next request would be swallowed.
			let ran = false;
			const handle = schedule(() => {
				ran = true;
				run();
			});
			if (!ran) cancel = handle;
		},
		flushNow() {
			if (!cancel) return;
			cancel();
			run();
		},
		dispose() {
			disposed = true;
			cancel?.();
			cancel = null;
		},
		get pending() {
			return cancel !== null;
		},
	};
}
