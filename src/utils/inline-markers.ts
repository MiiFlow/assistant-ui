// Regex to match inline markers: [VIZ:uuid] and [MEDIA:uuid]
const INLINE_MARKER_REGEX = /\[(VIZ|MEDIA):([a-f0-9-]+)\]/gi;

export type ContentPart =
  | { type: "text"; content: string }
  | { type: "viz"; id: string }
  | { type: "media"; id: string };

/**
 * Parse content and split it by inline markers ([VIZ:id] and [MEDIA:id]).
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
