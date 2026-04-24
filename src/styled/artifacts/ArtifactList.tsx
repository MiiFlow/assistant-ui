import type { ArtifactChunkData } from "../../types/streaming";
import { ArtifactInlineCard } from "./ArtifactInlineCard";
import { getArtifact } from "./registry";

export interface ArtifactListProps {
  artifacts: ArtifactChunkData[];
  isStreaming?: boolean;
  onOpen?: (artifact: ArtifactChunkData) => void;
}

/**
 * Renders one inline card per artifact using the registered renderer when
 * available; falls back to the unstyled `ArtifactInlineCard` otherwise.
 */
export function ArtifactList({
  artifacts,
  isStreaming,
  onOpen,
}: ArtifactListProps) {
  if (!artifacts?.length) return null;

  return (
    <div data-artifact-list style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {artifacts.map((artifact) => {
        const entry = getArtifact(artifact.kind);
        const Card = entry?.InlineCard ?? ArtifactInlineCard;
        return (
          <Card
            key={artifact.id}
            artifact={artifact}
            isStreaming={isStreaming}
            onOpen={onOpen}
          />
        );
      })}
    </div>
  );
}
