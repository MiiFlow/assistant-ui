import type { StreamingChunk } from "../types/streaming";

export interface MediaGeneration {
  id: string;
  kind: "image" | "video";
  editing: boolean;
  aspectRatio: string;
  state: "working" | "failed" | "stopped";
  jobId?: string;
}

// Presentation only: these are the supported media tools, not an authorization policy.
function mediaKind(name: string): "image" | "video" | undefined {
  const key = name.replace(/[.]/g, "_");
  if (/(^|_)(generate_ad_video|generate_seedance_video)$/.test(key))
    return "video";
  if (
    /(^|_)(generate_ad_image|edit_ad_image|generate_gpt_image_2|edit_gpt_image_2|generate_nano_banana_(2|pro)|edit_nano_banana_(2|pro))$/.test(
      key,
    )
  )
    return "image";
  if (
    /^stability_image_generate_(ultra|core|sd3_5_(large|large_turbo|medium))$/.test(
      key,
    )
  )
    return "image";
}

function result(content: string): Record<string, unknown> {
  try {
    const value = JSON.parse(content);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

/** Canonical transcript chunks carry the observation on the tool itself. Legacy
 * streams carry a separate observation; correlate those by call ID when present. */
export function mediaGenerations(
  chunks: StreamingChunk[],
  streaming: boolean,
): MediaGeneration[] {
  const cards: MediaGeneration[] = [];
  const used = new Set<StreamingChunk>();
  chunks.forEach((chunk, index) => {
    if (chunk.type === "subagent" && chunk.subagentData) {
      cards.push(
        ...mediaGenerations(
          chunk.subagentData.nestedChunks,
          streaming && chunk.subagentData.status === "running",
        ).map((card) => ({
          ...card,
          id: `${chunk.subagentData!.subagentId}:${card.id}`,
        })),
      );
    }
    if (chunk.type !== "tool") return;
    const kind = mediaKind(chunk.toolName || "");
    if (
      !kind ||
      chunk.approvalOutcome === "denied" ||
      chunk.status === "planned"
    )
      return;
    const observation = chunks.find(
      (candidate) =>
        candidate.type === "observation" &&
        !used.has(candidate) &&
        (candidate.toolCallId && chunk.toolCallId
          ? candidate.toolCallId === chunk.toolCallId
          : candidate.toolName === chunk.toolName && chunk.status !== "executing"),
    );
    if (observation) used.add(observation);
    const output = result(chunk.content || observation?.content || "");
    // Ready media is rendered by the existing media renderer, not a second card.
    if (output.__media__) return;
    const jobId =
      typeof output.job_id === "string" &&
      /^video_job_[\w-]+$/.test(output.job_id)
        ? output.job_id
        : undefined;
    const failed =
      chunk.success === false ||
      observation?.success === false ||
      !!output.error ||
      output.status === "failed" ||
      output.status === "needs_review";
    if (!jobId && !failed && (observation || chunk.status === "completed"))
      return;
    const args = chunk.toolArgs || {};
    const ratio =
      typeof args.aspect_ratio === "string" ? args.aspect_ratio : "";
    cards.push({
      id: chunk.toolCallId || `${chunk.toolName}:${index}`,
      kind,
      jobId,
      editing:
        (chunk.toolName || "").includes("edit_") ||
        !!args.reference_asset_id ||
        !!args.reference_media_ref ||
        !!args.source,
      aspectRatio: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].includes(ratio)
        ? ratio.replace(":", " / ")
        : kind === "video"
          ? "16 / 9"
          : "1 / 1",
      state: failed ? "failed" : jobId || streaming ? "working" : "stopped",
    });
  });
  // Idempotent checks of the same background job share one slot per message.
  const jobs = new Set<string>();
  return cards.filter((card) => {
    if (!card.jobId) return true;
    if (jobs.has(card.jobId)) return false;
    jobs.add(card.jobId);
    return true;
  });
}
