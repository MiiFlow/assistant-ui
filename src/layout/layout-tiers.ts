export const THREAD_LAYOUT = {
	NARROW_MAX: 660,
	WIDE_MIN: 700,
	PANEL_MIN: 360,
	PANEL_MAX: 800,
	/** Share of the layout the result panel may take: the inline `max-width` and the resizer cap both read it. */
	PANEL_MAX_SHARE: 0.6,
	DRAWER_MIN: 380,
	DRAWER_MAX: 720,
	DRAWER_DEFAULT: 500,
} as const;

export type ThreadLayoutTier = "wide" | "narrow";

/**
 * First-measurement classification, without hysteresis: there is no previous
 * tier to hold, and falling back to the unmeasured default would make the
 * starting layout depend on drag history. DRAWER_MAX (720px + chrome) clears
 * WIDE_MIN so the drawer can always reach the wide tier.
 */
export function classifyTier(hostWidth: number): ThreadLayoutTier {
	return Number.isFinite(hostWidth) && hostWidth > THREAD_LAYOUT.WIDE_MIN
		? "wide"
		: "narrow";
}

/**
 * Pure tier classification with a hysteresis band between NARROW_MAX and
 * WIDE_MIN: widths inside the band (or invalid/zero) hold the previous tier so
 * panels do not flip-flop when the host hovers at the boundary. The band's
 * floor is a side panel at its 360px minimum plus ~340px of usable thread.
 */
export function deriveTier(hostWidth: number, previous: ThreadLayoutTier): ThreadLayoutTier {
	if (!Number.isFinite(hostWidth) || hostWidth <= 0) {
		return previous;
	}
	if (hostWidth < THREAD_LAYOUT.NARROW_MAX) {
		return "narrow";
	}
	if (hostWidth > THREAD_LAYOUT.WIDE_MIN) {
		return "wide";
	}
	return previous;
}
