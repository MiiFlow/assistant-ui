/**
 * The citation marker the model writes: `[ref:LABEL]`.
 *
 * The server rewrites these to `[N]` as the answer streams
 * (`citation_processor.StreamCitationRewriter`) and leaves a marker it cannot
 * resolve in place. A client must never show a raw marker to a reader, and
 * both clients — this package and the web app — must strip the SAME grammar,
 * or a change to the label charset makes one of them leak text the other
 * hides. This is the one client-side spelling; do not add another.
 *
 * Labels may contain spaces (a connector's `"<server name>_<tool>"` form), so
 * the label is "anything up to the closing bracket".
 */
export const CITATION_MARKER_RE = /\[ref:[^\]]+\]/g;

/** Remove every `[ref:LABEL]` marker from `text`. */
export function stripCitationMarkers(text: string): string {
	// Fresh regex per call: the shared literal is /g and carries `lastIndex`.
	return text.replace(/\[ref:[^\]]+\]/g, "");
}
