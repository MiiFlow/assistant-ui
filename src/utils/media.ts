import { Lexer, type Token } from "marked";
import type { MediaChunkData, VisualizationChunkData, TableVisualizationData } from "../types/streaming";

export const CHAT_MEDIA_PATH =
  /^\/assistant\/(?:media\/[^/]+|messages\/[^/]+\/media\/[^/]+)\/content\/$/;

export function normalizeMedia(value: Record<string, any>): MediaChunkData {
  return {
    id: value.id,
    url: value.url || "",
    mediaType: value.media_type || value.mediaType || "image",
    altText: value.alt_text || value.altText || "",
    fileAssetId:
      value.file_asset_id || value.fileAssetId || value.metadata?.file_asset_id,
    sourceUrl: value.source_url || value.sourceUrl,
    status: value.status,
    errorMessage: value.error_message || value.errorMessage,
    posterUrl: value.poster_url || value.posterUrl,
    previewUrl: value.preview_url || value.previewUrl,
    context: value.context,
  };
}

export function upsertMedia(
  items: MediaChunkData[],
  item: MediaChunkData,
): MediaChunkData[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index < 0) return [...items, item];
  return items.map((existing, i) => (i === index ? item : existing));
}

export function toChatMediaProxyUrl(
  url: string,
  anonymousId?: string | null,
): string {
  if (!CHAT_MEDIA_PATH.test(url)) return url;
  const path = `/api/chat-media${url.slice("/assistant".length)}`;
  return anonymousId
    ? `${path}?anonymous_id=${encodeURIComponent(anonymousId)}`
    : path;
}

export function replaceMediaUrls(
  text: string,
  medias?: ReadonlyArray<MediaChunkData>,
): string {
  for (const media of medias || []) {
    if (media.sourceUrl && media.url && media.sourceUrl !== media.url) {
      text = text.split(media.sourceUrl).join(media.url);
    }
  }
  return text;
}

/** Resolve only explicitly referenced media from earlier messages in this transcript.
 * No global cache: another thread/organization can never donate a matching ID.
 */
export function withReferencedMedia<T extends { textContent?: string; medias?: MediaChunkData[]; visualizations?: VisualizationChunkData[] }>(messages: T[]): T[] {
  const available = new Map<string, MediaChunkData>();
  return messages.map(message => {
    for (const media of message.medias || []) available.set(media.id, media);
    const own = new Set((message.medias || []).map(media => media.id));
    const inherited: MediaChunkData[] = [];
    for (const id of inlineMediaIds(message.textContent || "")) {
      const media = available.get(id);
      if (media && !own.has(id)) { inherited.push(media); own.add(id); }
    }
    for (const viz of message.visualizations || []) {
      if (viz.type !== "table") continue;
      const data = viz.data as TableVisualizationData;
      for (const col of data.columns || []) {
        if (col.type !== "media") continue;
        for (const row of data.rows || []) {
          const cell = row[col.key];
          const id = typeof cell === "string" && cell.startsWith("media_ref:") ? cell.slice(10) : undefined;
          const media = id ? available.get(id) : undefined;
          if (media && !own.has(media.id)) {
            inherited.push(media);
            own.add(media.id);
          }
        }
      }
    }
    return inherited.length ? { ...message, medias: [...(message.medias || []), ...inherited] } : message;
  });
}

/** Explicit placements only. Bare IDs and names never associate a creative. */
export function mediaReferenceMatches(text: string) {
  return text.matchAll(/\[MEDIA:([^\]\s]+)\]/gi);
}

export function inlineMediaIds(text: string): Set<string> {
  const ids = new Set<string>();
  const visit = (tokens: Token[]) => {
    for (const token of tokens) {
      // Like the renderer, do not interpret markers inside code or links.
      if (["code", "codespan", "link", "html"].includes(token.type)) continue;
      if (token.type === "image" && token.href.startsWith("media_ref:")) {
        ids.add(token.href.slice(10));
      } else if (token.type === "table") {
        for (const cell of [...token.header, ...token.rows.flat()]) visit(cell.tokens);
      } else if (token.type === "list") {
        for (const item of token.items) visit(item.tokens);
      } else if ("tokens" in token && Array.isArray(token.tokens)) {
        visit(token.tokens);
      } else if (token.type === "text") {
        for (const match of mediaReferenceMatches(token.text)) ids.add(match[1]);
      }
    }
  };
  visit(Lexer.lex(text, { gfm: true }));
  return ids;
}

export function isCreativeReviewMedia(media: MediaChunkData): boolean {
  return media.context?.toolName === "creative_review" ||
    (/^act_[^:]+:/.test(media.id) && !!media.previewUrl);
}

/** Legacy creative answers can have media but no placements. Insert an explicit
 * inventory beside the introduction; never guess associations from ad names.
 * Explicitly placed answers keep the author's layout unchanged.
 */
export function placeUnreferencedCreatives(text: string, medias: readonly MediaChunkData[] = [], visualizations: VisualizationChunkData[] = []): string {
  if (!text.trim() || inlineMediaIds(text).size || /!\[[^\]]*\]\(/.test(text)) return text;
  if (visualizations.some(viz => viz.type === "table" && (viz.data as TableVisualizationData).columns?.some(col => col.type === "media"))) return text;
  const creatives = medias.filter(isCreativeReviewMedia);
  if (!creatives.length) return text;
  const escape = (value: string) => value.replace(/[\r\n]+/g, " ").replace(/[\\`*_[\]<>|]/g, char => `\\${char}`);
  const table = "**Retrieved creative examples**\n\n| Creative | Ad details |\n| --- | --- |\n" + creatives.map(media => `| ![](media_ref:${media.id}) | ${escape(media.altText || media.id)} |`).join("\n");
  const boundary = text.indexOf("\n\n");
  return boundary >= 0 ? text.slice(0, boundary) + "\n\n" + table + text.slice(boundary) : text + "\n\n" + table;
}
