import type { ActivityState } from "./labels";

/**
 * The package's own activity mark, used when the host supplies none.
 *
 * Deliberately unbranded: a square node in the activity colour. Running, an arc
 * travels its outline; done, a tick draws once (only when the run was watched
 * live); waiting, it breathes; failed and stopped are still.
 */
export function RunMark({ state, live }: { state: ActivityState; live: boolean }) {
	return (
		<svg
			className="mf-tx-mark"
			data-state={state}
			data-live={live ? "" : undefined}
			width={16}
			height={16}
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden
		>
			<rect x="1.5" y="1.5" width="13" height="13" rx="3.5" stroke="var(--mf-tx-rule)" strokeWidth="1.5" />
			{state === "running" && (
				<rect
					className="mf-tx-mark-arc"
					x="1.5"
					y="1.5"
					width="13"
					height="13"
					rx="3.5"
					stroke="var(--mf-tx-accent)"
					strokeWidth="1.5"
					strokeLinecap="round"
					pathLength={100}
					strokeDasharray="22 78"
				/>
			)}
			{state === "running" && <rect x="6" y="6" width="4" height="4" rx="1" fill="var(--mf-tx-accent)" />}
			{state === "waiting" && <rect x="5.5" y="5.5" width="5" height="5" rx="1.2" fill="var(--chat-warning)" />}
			{state === "done" && (
				<path
					className="mf-tx-mark-tick"
					d="M5 8.3 7.1 10.3 11 5.9"
					stroke="var(--chat-text)"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
					pathLength={100}
					strokeDasharray="100"
				/>
			)}
			{state === "failed" && (
				<path d="M5.5 5.5 10.5 10.5M10.5 5.5 5.5 10.5" stroke="var(--chat-error)" strokeWidth="1.6" strokeLinecap="round" />
			)}
			{state === "stopped" && <rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="var(--mf-tx-muted)" />}
		</svg>
	);
}
