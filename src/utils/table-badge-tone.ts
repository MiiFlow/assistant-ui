/**
 * The tone of a `badge` cell in a table visualization, shared by every
 * renderer (this package's table and a host's own) so a status never reads
 * as healthy in one and failing in another.
 *
 * Tones say something about state, not identity:
 * - success: healthy or done (active, completed, enabled)
 * - info:    in motion (pending, processing, running, queued, scheduled)
 * - warning: needs attention
 * - danger:  failed or blocked (failed, error, rejected)
 * - neutral: no judgement (inactive, draft, paused, disabled, archived)
 *
 * A value this map does not know is `null`: a plain label, not a state.
 */
export type TableBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Readonly<Record<string, TableBadgeTone>> = {
	active: "success",
	completed: "success",
	complete: "success",
	success: "success",
	succeeded: "success",
	enabled: "success",
	approved: "success",
	pending: "info",
	processing: "info",
	in_progress: "info",
	running: "info",
	queued: "info",
	scheduled: "info",
	warning: "warning",
	needs_review: "warning",
	needs_attention: "warning",
	failed: "danger",
	error: "danger",
	// Generic vocabulary for agent-written tables, where "rejected" is
	// usually a platform verdict (an ad rejected by review). A host with a
	// domain where rejection is a user's choice (the dashboard's dismissed
	// suggestions are neutral) renders that domain with its own tone map.
	rejected: "danger",
	inactive: "neutral",
	draft: "neutral",
	paused: "neutral",
	disabled: "neutral",
	archived: "neutral",
};

/** The tone for a badge value ("In progress" → info), or null for a plain label. */
export function tableBadgeTone(value: unknown): TableBadgeTone | null {
	if (value === null || value === undefined) return null;
	const key = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
	return TONES[key] ?? null;
}
