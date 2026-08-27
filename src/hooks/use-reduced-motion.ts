import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether the viewer has asked for reduced motion.
 *
 * The reasoning stream drives shimmer, a live meter and a blinking caret from
 * inline `animation` declarations, and a media query cannot override an inline
 * style — so the decision has to be made in JS and the effect simply not
 * applied. Starts `false` so server rendering and the first client paint agree.
 */
export function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia(QUERY);
		const apply = () => setReduced(mq.matches);
		apply();
		mq.addEventListener("change", apply);
		return () => mq.removeEventListener("change", apply);
	}, []);

	return reduced;
}
