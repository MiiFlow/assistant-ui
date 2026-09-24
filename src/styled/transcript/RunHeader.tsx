import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import { Chevron } from "../reasoning/icons";
import type { AgentTranscript } from "../../types/transcript";

/**
 * The run's status strip: mark, state, a ticking clock, and live counts —
 * readable progress while no text streams. A travelling line under it says
 * the run is alive during silent tool waits. Once the run completes it is the
 * fold toggle for the activity above the answer.
 */
export const RunHeader = forwardRef<
	HTMLButtonElement,
	{
		status: AgentTranscript["status"];
		mark: ReactNode;
		label: string;
		clock: string | null;
		stats: string[];
		foldable: boolean;
		open: boolean;
		controls: string;
		toggleTitle?: string;
		onToggle: () => void;
	}
>(function RunHeader({ status, mark, label, clock, stats, foldable, open, controls, toggleTitle, onToggle }, ref) {
	// The state word re-enters when it changes, so "Working" → "Worked for 12s"
	// reads as a transition rather than a text swap. Never on first paint.
	const stateRef = useRef<HTMLSpanElement>(null);
	const previous = useRef(label);
	useEffect(() => {
		const el = stateRef.current;
		if (!el || previous.current === label) return;
		previous.current = label;
		el.classList.remove("mf-tx-swap");
		void el.offsetWidth;
		el.classList.add("mf-tx-swap");
	}, [label]);

	return (
		<button
			ref={ref}
			type="button"
			className="mf-tx-hud"
			data-work-toggle
			data-status={status}
			data-foldable={foldable ? "" : undefined}
			disabled={!foldable}
			aria-expanded={open}
			aria-controls={controls}
			title={toggleTitle}
			onClick={onToggle}
		>
			<span className="mf-tx-hud-mark">{mark}</span>
			<span className="mf-tx-hud-main">
				<span ref={stateRef} className="mf-tx-hud-state">
					{label}
				</span>
				{clock && <span className="mf-tx-hud-time">{clock}</span>}
			</span>
			{stats.length > 0 && (
				<span className="mf-tx-hud-stats">
					{stats.map((stat, i) => (
						<span key={i}>{stat}</span>
					))}
				</span>
			)}
			{foldable && (
				<span className="mf-tx-hud-chev" aria-hidden>
					<Chevron size={12} />
				</span>
			)}
			<i className="mf-tx-hud-line" aria-hidden>
				<i className="mf-tx-hud-beam" />
			</i>
		</button>
	);
});
