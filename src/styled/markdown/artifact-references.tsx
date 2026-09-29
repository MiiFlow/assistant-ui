import { createContext, useContext, type ReactNode } from "react";
import type { ArtifactChunkData } from "../../types/streaming";

export interface MarkdownArtifactContextValue {
	/** The message's artifacts; a reference resolves against `markerId` or `id`. */
	artifacts: readonly ArtifactChunkData[];
	/** The host's opener for a file (e.g. a viewer). Without one a ready file
	 * opens its download URL. */
	onOpen?: (artifact: ArtifactChunkData) => void;
}

export const MarkdownArtifactContext = createContext<MarkdownArtifactContextValue>({ artifacts: [] });

/**
 * `[Report](ARTIFACT:id)` — a link to one of this message's files.
 *
 * Resolved, it opens the file the way its card does. Unresolved (the id names
 * no file on this message — a made-up id, or a file that failed), the label
 * renders as plain text: a link to nothing is never drawn, because the only
 * destination left for it is the page the reader is already on.
 */
export function ArtifactReference({ id, children }: { id: string; children: ReactNode }) {
	const { artifacts, onOpen } = useContext(MarkdownArtifactContext);
	const artifact = artifacts.find((item) => item.markerId === id || item.id === id);
	if (!artifact || artifact.status === "failed") return <span>{children}</span>;
	if (onOpen) {
		return (
			<button type="button" className="chat-prose__artifact-link" onClick={() => onOpen(artifact)}>
				{children}
			</button>
		);
	}
	if (artifact.url) {
		return (
			<a href={artifact.url} target="_blank" rel="noopener noreferrer">
				{children}
			</a>
		);
	}
	return <span>{children}</span>;
}
