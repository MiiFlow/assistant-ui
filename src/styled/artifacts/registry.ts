import type { ComponentType, ReactNode } from "react";
import type { ArtifactChunkData } from "../../types/streaming";

/**
 * Shape of a registered artifact type.
 *
 * Artifacts have a dual UI:
 *  - `InlineCard` is rendered inside the message body (compact, clickable).
 *  - `Viewer` is rendered inside the side-panel drawer (full preview).
 *
 * The app layer (`web/`) supplies MUI-skinned implementations; the unstyled
 * primitive `ArtifactInlineCard` is used as a fallback for headless consumers
 * (e.g. the embedded widget) that do not register MUI artifacts.
 */
export interface ArtifactEntry {
  type: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  InlineCard: ComponentType<{
    artifact: ArtifactChunkData;
    isStreaming?: boolean;
    onOpen?: (artifact: ArtifactChunkData) => void;
  }>;
  Viewer?: ComponentType<{ artifact: ArtifactChunkData }>;
  /** Optional description shown when no entry is registered for this type. */
  fallback?: ReactNode;
}

// Use globalThis to ensure a single registry instance even when the module
// is evaluated multiple times (e.g., Next.js transpilePackages re-bundling).
const REGISTRY_KEY = "__miiflow_artifact_registry__";
const registry: Map<string, ArtifactEntry> =
  (globalThis as any)[REGISTRY_KEY] ??
  ((globalThis as any)[REGISTRY_KEY] = new Map<string, ArtifactEntry>());

export function registerArtifact(type: string, entry: ArtifactEntry): void {
  registry.set(type, entry);
}

export function getArtifact(type: string): ArtifactEntry | undefined {
  return registry.get(type);
}

export function getRegisteredArtifactTypes(): string[] {
  return Array.from(registry.keys());
}
