import type { ArtifactChunkData } from "../../types/streaming";

export interface ArtifactInlineCardProps {
  artifact: ArtifactChunkData;
  isStreaming?: boolean;
  onOpen?: (artifact: ArtifactChunkData) => void;
}

/**
 * Unstyled primitive inline card. The app layer (`web/`) registers a
 * MUI-skinned version via `registerArtifact`; this primitive is the fallback
 * shipped with the chat-ui package so headless / embedded consumers still
 * render something when a tool emits an artifact.
 */
export function ArtifactInlineCard({
  artifact,
  isStreaming,
  onOpen,
}: ArtifactInlineCardProps) {
  const status = artifact.status ?? "ready";
  const isPending = status === "pending" || (isStreaming && status !== "failed");
  const isFailed = status === "failed";
  const isDisabled = isPending || isFailed;

  const handleClick = () => {
    if (!isDisabled) onOpen?.(artifact);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={
        isFailed
          ? `Artifact failed: ${artifact.title}`
          : `Open ${artifact.kind.toUpperCase()} artifact: ${artifact.title}`
      }
      data-artifact-id={artifact.id}
      data-artifact-status={status}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        marginTop: "8px",
        background: isFailed
          ? "var(--miiflow-artifact-error-bg, #fdecea)"
          : "var(--miiflow-artifact-bg, #f6f8fa)",
        border: "1px solid",
        borderColor: isFailed
          ? "var(--miiflow-artifact-error-border, #f1aeb5)"
          : "var(--miiflow-artifact-border, #d0d7de)",
        borderRadius: "8px",
        font: "inherit",
        color: "inherit",
        textAlign: "left",
        cursor: isDisabled ? (isFailed ? "default" : "progress") : "pointer",
        width: "100%",
        maxWidth: "420px",
        opacity: isPending ? 0.7 : 1,
      }}
    >
      <span aria-hidden style={{ fontSize: "22px", lineHeight: 1, flex: "0 0 auto" }}>
        {isFailed ? "⚠️" : "📄"}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {artifact.title}
        </span>
        <span
          style={{
            display: "block",
            fontSize: "12px",
            color: isFailed
              ? "var(--miiflow-artifact-error-text, #b42318)"
              : "var(--miiflow-artifact-meta, #57606a)",
          }}
        >
          {isFailed
            ? artifact.errorMessage || "Generation failed"
            : [
                artifact.kind.toUpperCase(),
                artifact.pageCount ? `${artifact.pageCount} pages` : null,
                isPending ? "generating…" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </span>
      </span>
    </button>
  );
}
