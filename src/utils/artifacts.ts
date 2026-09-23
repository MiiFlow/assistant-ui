import type { ArtifactChunkData } from "../types";

/**
 * One artifact as the chat renders it, from the server's wire shape.
 *
 * The SSE `artifact` event and a message's `metadata.artifacts` both carry the
 * server's snake_case dict (`size_bytes`, `page_count`, `marker_id`, ...);
 * `ArtifactChunkData` is camelCase. Storing the wire dict as-is left every
 * camelCase field undefined, so a card never learned its size or page count
 * and an `[ARTIFACT:…]` marker never resolved (`markerId`). Already-normalized
 * input passes through unchanged.
 */
export function normalizeArtifact(raw: Record<string, any>): ArtifactChunkData {
	return {
		id: raw.id,
		markerId: raw.markerId ?? raw.marker_id ?? undefined,
		kind: raw.kind,
		title: raw.title,
		description: raw.description,
		status: raw.status ?? "ready",
		url: raw.url ?? null,
		mimetype: raw.mimetype,
		sizeBytes: raw.sizeBytes ?? raw.size_bytes,
		pageCount: raw.pageCount ?? raw.page_count,
		createdAt: raw.createdAt ?? raw.created_at,
		errorMessage: raw.errorMessage ?? raw.error_message,
		context: raw.context,
	};
}
