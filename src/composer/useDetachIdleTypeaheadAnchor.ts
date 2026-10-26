import type { LexicalEditor } from "lexical";
import { useEffect, useState } from "react";

/** A module counter keeps each anchor class unique across React roots. */
let anchorSequence = 0;

/**
 * Lexical's `LexicalTypeaheadMenuPlugin` appends its menu anchor (a
 * `role=listbox` div labelled "Typeahead menu") to the page as soon as the
 * plugin mounts, not when a menu opens. Every mounted editor with a typeahead
 * therefore left an empty, id-less listbox in the page for screen readers to
 * land on (V3-BUG-014). This hook takes the idle anchor out again; Lexical
 * appends it, with its role and label, the moment a menu opens.
 *
 * Returns the class name to pass as the plugin's `anchorClassName`. `open` is
 * the plugin's menu state (track it with `onOpen` / `onClose`); `enabled`
 * is false while the plugin is not rendered.
 */
export function useDetachIdleTypeaheadAnchor(
  editor: LexicalEditor,
  open: boolean,
  enabled = true,
): string {
  const [anchorClassName] = useState(() => `typeahead-anchor-${++anchorSequence}`);
  useEffect(() => {
    if (open || !enabled) return;
    // Lexical puts the anchor in the editor's shadow root when it has one,
    // and in the document body otherwise.
    const rootNode = editor.getRootElement()?.getRootNode();
    const scope: ParentNode =
      rootNode && "querySelectorAll" in rootNode ? (rootNode as ParentNode) : document;
    for (const anchor of [...scope.querySelectorAll(`.${anchorClassName}`)]) {
      // An anchor with children is hosting an open menu's portal: keep it.
      if (anchor.childElementCount === 0) anchor.remove();
    }
  }, [editor, open, enabled, anchorClassName]);
  return anchorClassName;
}
