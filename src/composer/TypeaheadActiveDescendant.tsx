import {
  COMMAND_PRIORITY_NORMAL,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  type LexicalEditor,
} from "lexical";
import { useEffect } from "react";

export interface TypeaheadActiveDescendantProps {
  editor: LexicalEditor;
  /** The `selectedIndex` Lexical passes to `menuRenderFn`. */
  selectedIndex: number | null;
  /** How many options the menu has right now (0 while loading). */
  optionCount: number;
}

/**
 * Keeps the editor's `aria-activedescendant` on an option that exists
 * (V3-BUG-339). Render it from a `LexicalTypeaheadMenuPlugin` `menuRenderFn`
 * whose options carry the ids `typeahead-item-<index>`, next to the menu.
 *
 * It compensates for Lexical's `LexicalMenu` (checked against 0.52 and 0.53):
 * Lexical writes `typeahead-item-<index>` on the editor root itself, including
 * `typeahead-item-0` on open while the list is still loading. With a custom
 * `menuRenderFn` it also handles Up and Down on an empty list, clamps the
 * highlight to `options.length - 1` (-1 when empty), writes
 * `typeahead-item--1` and keeps the -1 after the options arrive, since its
 * preselect only runs for `null`. Remove this once Lexical skips ids outside
 * the option list.
 *
 * Two parts: the key guard stops the -1 highlight from being recorded (so the
 * first option is highlighted once the list loads), and the effect keeps the
 * attribute in step with the highlighted option, or removes it when there is
 * none.
 */
export function TypeaheadActiveDescendant({
  editor,
  selectedIndex,
  optionCount,
}: TypeaheadActiveDescendantProps): null {
  const empty = optionCount === 0;

  // With nothing to move through, Up and Down are consumed here, above
  // Lexical's own handler (COMMAND_PRIORITY_LOW), which would record -1. The
  // open menu already consumed them, so the caret does not move either way.
  useEffect(() => {
    if (!empty) return;
    const swallow = (event: KeyboardEvent | null) => {
      // What Lexical's own handler does for these keys while the menu is open.
      event?.preventDefault();
      event?.stopImmediatePropagation();
      return true;
    };
    const offDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      swallow,
      COMMAND_PRIORITY_NORMAL,
    );
    const offUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      swallow,
      COMMAND_PRIORITY_NORMAL,
    );
    return () => {
      offDown();
      offUp();
    };
  }, [editor, empty]);

  // A passive effect runs after Lexical's own layout effect (a parent's), so
  // it has the last word. Lexical clamps selectedIndex to the option count.
  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    if (empty || selectedIndex == null || selectedIndex < 0) {
      root.removeAttribute("aria-activedescendant");
    } else {
      root.setAttribute("aria-activedescendant", `typeahead-item-${selectedIndex}`);
    }
  }, [editor, empty, selectedIndex]);

  return null;
}
