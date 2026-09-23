import type { StreamingChunk } from "./streaming";

/** Display contract v1. Text is speech, never a prediction of run completion. */
export interface TranscriptBlock {
  id: string;
  kind: "text" | "reasoning" | "tool" | "subagent";
  text?: string;
  /** Wire-only append; snapshots always contain full text. */
  textDelta?: string;
  step?: number | string;
  interrupted?: boolean;
  /** Set on completion; ordinary speech remains text. */
  isFinal?: boolean;
  chunk?: StreamingChunk;
  subagentId?: string;
}
export interface AgentTranscript {
  version: 1;
  status: "running" | "waiting" | "completed" | "stopped" | "failed";
  blocks: TranscriptBlock[];
}

export function readTranscript(value: unknown): AgentTranscript | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as AgentTranscript;
  return v.version === 1 && Array.isArray(v.blocks) ? v : undefined;
}

/** Copy-on-write keeps block identity stable across unrelated tool updates. */
export function updateTranscript(
  current: AgentTranscript | undefined,
  frame: AgentTranscript,
): AgentTranscript {
  const blocks = [...(current?.blocks ?? [])];
  for (const block of frame.blocks) {
    const index = blocks.findIndex((b) => b.id === block.id);
    const { textDelta, ...value } = block;
    const next =
      textDelta === undefined
        ? value
        : {
            ...value,
            text: (index < 0 ? "" : blocks[index].text || "") + textDelta,
          };
    if (index < 0) blocks.push(next);
    else blocks[index] = next;
  }
  return { version: 1, status: frame.status, blocks };
}
