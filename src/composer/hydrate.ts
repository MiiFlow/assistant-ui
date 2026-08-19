import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type ParagraphNode,
} from "lexical";

import { $createCommandTokenNode, findInlineCommandTokens } from "./CommandTokenNode";

export type ResolveTokenLabel = (id: string, kind: string) => string | undefined;

/**
 * Rebuild editor content from the plain-text projection the editor itself
 * emits (`root.getTextContent()` / `ChatComposerSubmitPayload.text`).
 *
 * The exact inverse of Lexical's projection: paragraphs are joined with
 * `"\n\n"` and a `LineBreakNode` is `"\n"`, so `"\n\n"` splits paragraphs and
 * `"\n"` inside one becomes a line break. `<prefix><id>:<kind>` substrings
 * become chips again; `resolveLabel` supplies a display label for ids that
 * are opaque (ad accounts) — it falls back to the id.
 *
 * Must run inside `editor.update()` (or as `initialConfig.editorState`).
 */
export function $hydrateFromEncodedText(text: string, resolveLabel?: ResolveTokenLabel): void {
  const root = $getRoot();
  root.clear();
  const paragraphs = (text ?? "").split("\n\n");
  for (const paragraphText of paragraphs) {
    const paragraph: ParagraphNode = $createParagraphNode();
    const lines = paragraphText.split("\n");
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) paragraph.append($createLineBreakNode());
      let cursor = 0;
      for (const match of findInlineCommandTokens(line)) {
        if (match.index > cursor) {
          paragraph.append($createTextNode(line.slice(cursor, match.index)));
        }
        paragraph.append(
          $createCommandTokenNode(
            match.id,
            match.kind,
            resolveLabel?.(match.id, match.kind) ?? match.id,
            match.prefix,
          ),
        );
        cursor = match.endIndex;
      }
      if (cursor < line.length) {
        paragraph.append($createTextNode(line.slice(cursor)));
      }
    });
    root.append(paragraph);
  }
}
