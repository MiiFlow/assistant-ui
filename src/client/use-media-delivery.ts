import { useEffect, useRef, useState } from "react";
import type { MediaChunkData } from "../types/streaming";
import { CHAT_MEDIA_PATH } from "../utils/media";
import { TOKEN_REFRESH_LEAD_MS, isTokenExpiringSoon } from "./token-utils";
import { fetchOrNetworkError, HttpError, readBody } from "./network";
import { refreshSessionToken } from "./session";

/** Fetch private widget images with headers, then render local blob URLs.
 * Credentials never appear in an image URL or leak to an external provider.
 */
export function useMediaDelivery(
  medias: MediaChunkData[],
  baseUrl: string,
  token: string | undefined,
  publicKey: string,
  scope: string,
  onToken: (token: string) => void,
) {
  const [resources, setResources] = useState<Record<string, string | false>>(
    {},
  );
  const jobs = useRef(new Map<string, AbortController>());
  const blobs = useRef(new Set<string>());
  const loaded = useRef(new Set<string>());
  const refresh = useRef<Promise<string> | null>(null);
  const generation = useRef(0);
  const urls = JSON.stringify([
    ...new Set(
      medias
        .filter((m) => m.status !== "failed" && CHAT_MEDIA_PATH.test(m.url))
        .map((m) => m.url),
    ),
  ]);

  useEffect(() => {
    setResources({});
    loaded.current.clear();
    return () => {
      generation.current += 1;
      for (const controller of jobs.current.values()) controller.abort();
      jobs.current.clear();
      for (const url of blobs.current) URL.revokeObjectURL(url);
      blobs.current.clear();
      loaded.current.clear();
      refresh.current = null;
    };
  }, [scope]);

  useEffect(() => {
    if (!token) return;
    const currentGeneration = generation.current;
    for (const path of JSON.parse(urls) as string[]) {
      if (loaded.current.has(path) || jobs.current.has(path)) continue;
      const controller = new AbortController();
      jobs.current.set(path, controller);
      const load = async () => {
        let accessToken = token;
        if (isTokenExpiringSoon(accessToken, TOKEN_REFRESH_LEAD_MS)) {
          if (!refresh.current) {
            const refreshing = refreshSessionToken(baseUrl, accessToken, publicKey)
              .then((fresh) => {
                if (generation.current === currentGeneration) onToken(fresh);
                return fresh;
              })
              .finally(() => {
                if (refresh.current === refreshing) refresh.current = null;
              });
            refresh.current = refreshing;
          }
          accessToken = await refresh.current;
        }
        if (controller.signal.aborted) return;
        const response = await fetchOrNetworkError(`${baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new HttpError("Image unavailable", response.status);
        const blob = await readBody(() => response.blob());
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        blobs.current.add(url);
        loaded.current.add(path);
        setResources((current) => ({ ...current, [path]: url }));
      };
      void load()
        .catch(() => {
          if (!controller.signal.aborted)
            setResources((current) => ({ ...current, [path]: false }));
        })
        .finally(() => {
          if (jobs.current.get(path) === controller) jobs.current.delete(path);
        });
    }
  }, [urls, token, baseUrl, publicKey, scope, onToken]);
  return resources;
}

export function deliveredMedia(
  media: MediaChunkData,
  resources: Record<string, string | false>,
): MediaChunkData {
  if (!CHAT_MEDIA_PATH.test(media.url)) return media;
  const resource = resources[media.url];
  return {
    ...media,
    url: resource || "",
    sourceUrl: media.sourceUrl || media.url,
    status: resource === false ? "failed" : resource ? "ready" : "pending",
    errorMessage:
      resource === false
        ? "Image unavailable. Reopen the conversation to retry."
        : media.errorMessage,
  };
}
