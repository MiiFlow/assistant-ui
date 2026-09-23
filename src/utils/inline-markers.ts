// Inline markers: [VIZ:id], [MEDIA:id], [SA:id] and [ARTIFACT:id]. The kinds
// are declared once; every pattern below is built from this list, so adding a
// kind cannot leave one of them behind (the partial-marker list was once
// hand-spelled letter by letter).
const MARKER_KINDS = ["VIZ", "MEDIA", "SA", "ARTIFACT"] as const;
const KIND_ALTERNATION = MARKER_KINDS.join("|");

// The id is "anything up to the closing bracket" on purpose. Real ids are
// hex (VIZ/MEDIA) or TokenField ids (SA), but the grammar has to catch every
// marker-SHAPED token, because a marker that reaches the renderer unmatched
// is shown to the reader as text. Production had `[VIZ:…]` — a literal
// ellipsis, quoted from a prompt — rendered raw for exactly this reason. An
// id that resolves to nothing renders nothing; that is the floor.
const INLINE_MARKER_SOURCE = `\\[(${KIND_ALTERNATION}):([^\\]]+)\\]`;
const INLINE_MARKER_REGEX = new RegExp(INLINE_MARKER_SOURCE, "gi");

/**
 * Remove every inline marker from `content`.
 *
 * The render floor for the plain-text branches: a marker that reached the
 * renderer without render data behind it cannot be shown to a reader as a
 * bare `[VIZ:9fc0ad9c…]`. Kept here, beside the parser, so the marker grammar
 * has exactly one definition — the previous caller-local `[MEDIA:…]`-only
 * regex is how `[VIZ:…]` came to leak.
 */
export function stripInlineMarkers(content: string): string {
  // Fresh regex per call: the shared literal is /g and carries `lastIndex`.
  return content.replace(new RegExp(INLINE_MARKER_SOURCE, "gi"), "");
}

/**
 * The tail of a streaming text that could still become an inline marker:
 * `[`, `[VI`, `[VIZ:`, `[VIZ:9fc0…` and the same for every marker kind. The
 * marker only splits the content once its closing bracket arrives, so for a
 * few tokens the raw prefix would otherwise render as text and then vanish.
 */
const KIND_PREFIXES = MARKER_KINDS.flatMap((kind) =>
	Array.from({ length: kind.length }, (_, i) => kind.slice(0, i + 1)),
);
const PARTIAL_TRAILING_MARKER_REGEX = new RegExp(
	`\\[(?:(?:${KIND_ALTERNATION}):[^\\]]*|${KIND_PREFIXES.join("|")})?$`,
	"i",
);

/**
 * Drop a trailing fragment of an inline marker from text that is still
 * streaming. A completed marker is untouched — only the unfinished tail goes,
 * and it comes back whole once its closing bracket streams in.
 */
export function trimPartialTrailingMarker(content: string): string {
	return content.replace(PARTIAL_TRAILING_MARKER_REGEX, "");
}

export type ContentPart =
  | { type: "text"; content: string }
  | { type: "viz"; id: string }
  | { type: "media"; id: string }
  | { type: "sa"; id: string }
  | { type: "artifact"; id: string };

/**
 * Parse content and split it by inline markers ([VIZ:id], [MEDIA:id], [SA:id] and
 * [ARTIFACT:id]). An artifact marker carries the artifact's `markerId`.
 */
export function parseContentWithInlineMarkers(content: string, preserveMedia = false): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;
  let match;

  INLINE_MARKER_REGEX.lastIndex = 0;

  while ((match = INLINE_MARKER_REGEX.exec(content)) !== null) {
    if (preserveMedia && match[1].toUpperCase() === "MEDIA") continue;
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      if (text.trim()) {
        parts.push({ type: "text", content: text });
      }
    }

    const markerType = match[1].toUpperCase();
    if (markerType === "VIZ") {
      parts.push({ type: "viz", id: match[2] });
    } else if (markerType === "SA") {
      parts.push({ type: "sa", id: match[2] });
    } else if (markerType === "ARTIFACT") {
      parts.push({ type: "artifact", id: match[2] });
    } else {
      parts.push({ type: "media", id: match[2] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    if (text.trim()) {
      parts.push({ type: "text", content: text });
    }
  }

  return parts;
}
