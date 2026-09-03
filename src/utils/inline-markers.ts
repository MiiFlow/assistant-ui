// Regex to match inline markers: [VIZ:uuid], [MEDIA:uuid], and [SA:id]
// VIZ/MEDIA use hex UUIDs; SA uses TokenField IDs (alphanumeric + underscore, e.g. saction_AbC123xYz)
const INLINE_MARKER_REGEX = /\[(VIZ|MEDIA|SA):([\w-]+)\]/gi;

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
  return content.replace(/\[(VIZ|MEDIA|SA):([\w-]+)\]/gi, "");
}

export type ContentPart =
  | { type: "text"; content: string }
  | { type: "viz"; id: string }
  | { type: "media"; id: string }
  | { type: "sa"; id: string };

/**
 * Parse content and split it by inline markers ([VIZ:id], [MEDIA:id], and [SA:id]).
 */
export function parseContentWithInlineMarkers(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;
  let match;

  INLINE_MARKER_REGEX.lastIndex = 0;

  while ((match = INLINE_MARKER_REGEX.exec(content)) !== null) {
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
