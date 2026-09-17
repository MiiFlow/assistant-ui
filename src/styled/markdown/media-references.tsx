import { mediaReferenceMatches } from "../../utils/media";
import { createContext, useContext, useState } from "react";
import type { MediaChunkData } from "../../types";
import { MediaLightbox, useMediaLightbox } from "../MediaLightbox";

export const MarkdownMediaContext = createContext<readonly MediaChunkData[]>([]);

/** Transform text markers inside the Markdown tree, preserving lists and tables.
 * Code nodes are never visited as text, so literal examples stay literal.
 */
export function remarkMediaReferences() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node.children || node.type === "link" || node.type === "image") return;
      node.children = node.children.flatMap((child: any) => {
        if (child.type !== "text") { walk(child); return [child]; }
        const parts: any[] = [];
        let end = 0;
        for (const match of mediaReferenceMatches(child.value)) {
          if (match.index > end) parts.push({ type: "text", value: child.value.slice(end, match.index) });
          parts.push({ type: "image", url: `media_ref:${match[1]}`, alt: "" });
          end = match.index + match[0].length;
        }
        if (!parts.length) return [child];
        if (end < child.value.length) parts.push({ type: "text", value: child.value.slice(end) });
        return parts;
      });
    };
    walk(tree);
  };
}

export function ReferencedMedia({ id, alt }: { id: string; alt?: string }) {
  const media = useContext(MarkdownMediaContext).find(item => item.id === id);
  const [failedPreview, setFailedPreview] = useState<string>();
  const items = media?.url ? [media] : [];
  const { index, open, close, navigate } = useMediaLightbox(items);
  if (!media || !media.url || media.status === "pending" || media.status === "failed") {
    return <span role="status">{media?.status === "pending" ? "Loading preview…" : "Preview unavailable"}</span>;
  }
  const previewSrc = media.mediaType === "video" ? media.posterUrl : media.url;
  const previewFailed = !!previewSrc && failedPreview === previewSrc;
  const label = alt || media.altText || (media.mediaType === "video" ? "Open video" : "Open image");
  return <span data-inline-media={id} className="inline-flex max-w-full flex-col gap-1 align-top">
    <button type="button" onClick={() => open(0)} aria-label={label} className="block max-w-full overflow-hidden rounded-lg border-0 bg-transparent p-0">
      {previewFailed ? <span role="status">Preview unavailable</span> : media.mediaType === "video" ? <span className="relative inline-block">
        {media.posterUrl ? <img onError={() => setFailedPreview(media.posterUrl)} src={media.posterUrl} alt={label} loading="lazy" style={{ maxWidth: 240, maxHeight: 180 }} /> : <span className="inline-block bg-gray-900 p-6 text-white">Video preview</span>}
        <span className="absolute inset-0 flex items-center justify-center text-white" aria-hidden>▶</span>
      </span> : <img onError={() => setFailedPreview(media.url)} src={media.url} alt={label} loading="lazy" style={{ maxWidth: "min(240px, 100%)", maxHeight: 240, objectFit: "contain" }} />}
    </button>
    {media.previewUrl && /^https?:\/\//i.test(media.previewUrl) && <a href={media.previewUrl} target="_blank" rel="noopener noreferrer">Open in Meta</a>}
    {index !== null && <MediaLightbox items={items} index={index} onClose={close} onNavigate={navigate} />}
  </span>;
}
