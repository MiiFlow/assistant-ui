import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode } from "react";
import { stripCitationMarkers } from "../utils/citations";
import type { AgentTranscript } from "../types/transcript";
import type { StreamingChunk } from "../types";
import { isInternalTool, buildRunSteps } from "./reasoning/build-steps";
import { StepBlock } from "./reasoning/StepBlock";
import { MarkdownContent } from "./MarkdownContent";

/** Stable chronological slots; receiving a tool never relocates prior speech. */
export function TranscriptFlow({
  transcript,
  chunks,
  isStreaming,
  renderText,
  executionTime,
  streamStartedAt,
}: {
  transcript: AgentTranscript;
  chunks?: StreamingChunk[];
  isStreaming?: boolean;
  executionTime?: number;
  streamStartedAt?: number;
  renderText: (text: string, streaming?: boolean) => ReactNode;
}) {
  const status =
    transcript.status === "running" && !isStreaming
      ? "stopped"
      : transcript.status;
  const root = useRef<HTMLDivElement>(null);
  const regionId = useId();
  const [keepOpen, setKeepOpen] = useState(false);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  // Observe the actual chat viewport, not window scroll. Reading older content
  // is a reason to preserve the layout even if no disclosure was opened.
  useEffect(() => {
    const element = root.current;
    let viewport = element?.parentElement;
    while (viewport && !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)) {
      viewport = viewport.parentElement;
    }
    if (!viewport) return;
    let previous = viewport.scrollTop;
    const onScroll = () => {
      if (viewport!.scrollTop < previous - 1) setKeepOpen(true);
      previous = viewport!.scrollTop;
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport?.removeEventListener("scroll", onScroll);
  }, []);

  // New snapshots identify the final answer explicitly. Older v1 snapshots
  // retain their last uninterrupted speech block as the answer.
  const explicitFinal = transcript.blocks.some((b) => b.isFinal);
  const lastText = transcript.blocks.reduce((last, b, i) =>
    b.kind === "text" && !b.interrupted ? i : last, -1);
  const isAnswer = (index: number) => {
    const block = transcript.blocks[index];
    return status === "completed" && block.kind === "text" && !block.interrupted &&
      (explicitFinal ? !!block.isFinal : index === lastText);
  };
  const hasAnswer = transcript.blocks.some((_, index) => isAnswer(index));
  const hasWork = transcript.blocks.some((_, index) => !isAnswer(index));
  const canFold = status === "completed" && hasAnswer && hasWork;
  const workOpen = expanded ?? (!canFold || keepOpen);
  const lastBlock = transcript.blocks.length - 1;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (status !== "running") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);
  const seconds = status === "running" && streamStartedAt
    ? Math.max(0, Math.floor((now - streamStartedAt) / 1000)) : executionTime;
  const duration = seconds != null && seconds > 0
    ? seconds < 60 ? `${Math.floor(seconds)}s` : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
    : null;
  const specialists = new Set(transcript.blocks.filter(b => b.kind === "subagent").map(b => b.subagentId)).size;
  const countTools = (items: StreamingChunk[]): number => items.reduce((count, chunk) =>
    count + (chunk.type === "tool" && !isInternalTool(chunk.toolName) ? 1 : 0) +
    (chunk.subagentData ? countTools(chunk.subagentData.nestedChunks ?? []) : 0), 0);
  const toolCount = transcript.blocks.filter(b => b.kind === "tool" && !isInternalTool(b.chunk?.toolName)).length +
    transcript.blocks.filter(b => b.kind === "subagent").reduce((count, block) => count +
      countTools(chunks?.find(c => c.subagentData?.subagentId === block.subagentId)?.subagentData?.nestedChunks ?? []), 0);
  const title = status === "running" ? "Working" : status === "completed" ? "Worked" : status === "waiting" ? "Waiting for input" : status === "failed" ? "Run failed" : "Stopped";
  const anchor = useRef<{ viewport: HTMLElement; y: number } | null>(null);
  const header = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    let viewport = root.current?.parentElement;
    while (viewport && !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)) viewport = viewport.parentElement;
    if (viewport && header.current) {
      // Use the scroll engine's existing user-intent path to release bottom
      // following before the content resize, just like dragging its scrollbar.
      viewport.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 0 }));
      anchor.current = { viewport, y: header.current.getBoundingClientRect().top };
    }
    setExpanded(!workOpen);
  };
  useLayoutEffect(() => {
    const saved = anchor.current;
    if (!saved || !header.current) return;
    const restore = () => {
      if (header.current) saved.viewport.scrollTop += header.current.getBoundingClientRect().top - saved.y;
    };
    restore();
    const frame = requestAnimationFrame(restore);
    anchor.current = null;
    return () => cancelAnimationFrame(frame);
  }, [expanded]);
  const renderBlock = (block: AgentTranscript["blocks"][number], index: number) => {

        const slot = { id: `${regionId}-${index}` };
        const live = status === "running" && !!isStreaming && index === lastBlock;
        if (block.kind === "text")
          return (
            <div {...slot} key={block.id} data-transcript-block={block.id}>
              {renderText(stripCitationMarkers(block.text || ""), live)}
              {block.interrupted && (
                <p className="text-xs text-muted-foreground">
                  Response interrupted
                </p>
              )}
            </div>
          );
        if (block.kind === "reasoning")
          return (
            <details {...slot} key={block.id} data-transcript-block={block.id}>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Reasoning
              </summary>
              <MarkdownContent isStreaming={live}>
                {block.text || ""}
              </MarkdownContent>
            </details>
          );
        const chunk =
          block.kind === "tool"
            ? block.chunk
            : chunks?.find(
                (c) => c.subagentData?.subagentId === block.subagentId,
              );
        if (!chunk) return null;
        const steps = buildRunSteps([chunk], status === "running", {
          outcome:
            status === "waiting"
              ? "approval"
              : status === "failed"
                ? "error"
                : "answered",
          ok: status === "completed",
          stopped: status === "stopped",
        });
        if (!steps.length) return null;
        if (block.kind === "tool")
          return (
            <details {...slot} key={block.id} data-transcript-block={block.id}>
              <summary
                className="cursor-pointer list-none"
                aria-label={
                  chunk.toolDescription || chunk.toolName || "Tool details"
                }
              >
                {steps.map((step) => (
                  <StepBlock key={step.id} step={step} />
                ))}
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {chunk.content || "No result yet."}
              </pre>
            </details>
          );
        return (
          <div {...slot} key={block.id} data-transcript-block={block.id}>
            {steps.map((step) => (
              <StepBlock key={step.id} step={step} />
            ))}
          </div>
        );
  };
  return (
    <div ref={root} className="flex flex-col gap-3" data-agent-transcript="1"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("summary, button") &&
            !(event.target as HTMLElement).closest("[data-work-toggle]")) setKeepOpen(true);
      }}>
      {(hasWork || status !== "completed") && <button ref={header} type="button" data-work-toggle
        disabled={!canFold}
        className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2"
        style={{ color: "var(--chat-text)", background: "color-mix(in srgb, var(--chat-text) 4%, transparent)", minHeight: 36 }}
        aria-expanded={workOpen} aria-controls={regionId}
        title={canFold ? workOpen ? "Collapse activity" : "Expand activity" : undefined}
        onClick={toggle}>
        <span aria-hidden="true" style={{ width: 16, flexShrink: 0 }}>{status === "completed" ? "✓" : status === "running" ? "◌" : "·"}</span>
        <span style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{title}{duration ? `${status === "completed" ? " for" : " ·"} ${duration}` : ""}</span>
        <span className="text-xs text-muted-foreground" style={{ flex: 1, minWidth: 0 }}>
          {[specialists ? `${specialists} specialist${specialists === 1 ? "" : "s"}` : "", toolCount ? `${toolCount} tool call${toolCount === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}
        </span>
        {canFold && <span aria-hidden="true">{workOpen ? "⌄" : "›"}</span>}
      </button>}
      <div id={regionId} data-activity-panel
        hidden={!hasWork || (canFold && !workOpen)}
        role="region" aria-label="Agent activity"
        style={{ borderLeft: "1px solid color-mix(in srgb, var(--chat-text) 12%, transparent)", paddingLeft: 12 }}>
        <div className="flex flex-col gap-3">
          {transcript.blocks.map((block, index) => !isAnswer(index) ? renderBlock(block, index) : null)}
        </div>
      </div>
      {transcript.blocks.map((block, index) => isAnswer(index) ? renderBlock(block, index) : null)}
    </div>
  );
}
