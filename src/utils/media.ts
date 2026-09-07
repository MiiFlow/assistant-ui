import type { MediaChunkData } from "../types/streaming";

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
