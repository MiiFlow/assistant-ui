import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { CornerDownLeft } from "lucide-react";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  HISTORY_PUSH_TAG,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
} from "lexical";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CommandMenuContext } from "./CommandMenuContext";

export interface FollowUpSuggestion {
  id: string;
  text: string;
}

/** Draft text filters the picker. Choosing a row replaces it with an undoable draft. */
export function FollowUpSuggestionsPlugin({
  suggestions,
  anchorElement,
  disabled,
}: {
  suggestions: readonly FollowUpSuggestion[];
  anchorElement: HTMLElement | null;
  disabled: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const textRef = useRef<string | null>(null);
  const commandMenu = useContext(CommandMenuContext);
  const filteredSuggestions = useMemo(() => {
    if (text === null) return [];
    const query = text.trim().toLocaleLowerCase();
    return suggestions.filter((suggestion) =>
      suggestion.text.toLocaleLowerCase().includes(query),
    );
  }, [suggestions, text]);
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open =
    focused &&
    !commandMenu.isOpen &&
    !dismissed &&
    !disabled &&
    filteredSuggestions.length > 0 &&
    !!anchorElement;

  useEffect(() => {
    const readText = () =>
      editor.getEditorState().read(() => {
        const next = $getRoot().getTextContent();
        setText(next);
        if (textRef.current !== next) {
          textRef.current = next;
          setSelected(null);
        }
      });
    readText();
    const unregisterUpdate = editor.registerUpdateListener(readText);
    let removeFocusListeners = () => {};
    const unregisterRoot = editor.registerRootListener((root) => {
      removeFocusListeners();
      setFocused(root === root?.ownerDocument.activeElement);
      if (!root) return;
      const focus = () => {
        setFocused(true);
        setDismissed(false);
        setSelected(null);
      };
      const blur = () => {
        setFocused(false);
        setSelected(null);
      };
      root.addEventListener("focus", focus);
      root.addEventListener("blur", blur);
      removeFocusListeners = () => {
        root.removeEventListener("focus", focus);
        root.removeEventListener("blur", blur);
      };
    });
    return () => {
      unregisterUpdate();
      unregisterRoot();
      removeFocusListeners();
    };
  }, [editor]);

  const accept = useCallback(
    (index: number) => {
      const suggestion = filteredSuggestions[index];
      if (
        !open ||
        !suggestion ||
        editor.isComposing() ||
        commandMenu.isOpenNow()
      )
        return;
      // A stale row must not overwrite a more recent edit.
      const currentText = editor
        .getEditorState()
        .read(() => $getRoot().getTextContent());
      if (currentText !== text) return;
      setDismissed(true);
      setSelected(null);
      editor.update(
        () => {
          const root = $getRoot();
          root.clear().append($createParagraphNode());
          root.selectEnd();
          const selection = $getSelection();
          if ($isRangeSelection(selection))
            selection.insertRawText(suggestion.text);
        },
        { tag: HISTORY_PUSH_TAG },
      );
      editor.focus();
    },
    [editor, open, filteredSuggestions, text, commandMenu],
  );

  useEffect(() => {
    const canNavigate = (event: KeyboardEvent | null) =>
      open &&
      !commandMenu.isOpenNow() &&
      !event?.isComposing &&
      !editor.isComposing() &&
      event?.keyCode !== 229 &&
      !event?.shiftKey &&
      !event?.altKey &&
      !event?.metaKey &&
      !event?.ctrlKey &&
      $getRoot().getTextContent() === text;
    const navigate = (event: KeyboardEvent, direction: number) => {
      if (!canNavigate(event)) return false;
      event.preventDefault();
      setSelected((current) =>
        current === null
          ? direction > 0
            ? 0
            : filteredSuggestions.length - 1
          : Math.max(
              0,
              Math.min(filteredSuggestions.length - 1, current + direction),
            ),
      );
      return true;
    };
    // Higher than Enter-to-send, but existing command menus own their keys.
    const unregister = [
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => navigate(event, 1),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => navigate(event, -1),
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!canNavigate(event) || selected === null) return false;
          event?.preventDefault();
          accept(selected);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (!canNavigate(event)) return false;
          event.preventDefault();
          setDismissed(true);
          setSelected(null);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    ];
    return () => unregister.forEach((remove) => remove());
  }, [
    editor,
    open,
    filteredSuggestions.length,
    selected,
    accept,
    text,
    commandMenu,
  ]);

  useEffect(() => {
    if (!open) return;
    const root = editor.getRootElement();
    if (!root) return;
    const attributes = {
      "aria-controls": id,
      "aria-haspopup": "listbox",
      "aria-activedescendant": selected === null ? null : `${id}-${selected}`,
    };
    const previous = Object.keys(attributes).map(
      (name) => [name, root.getAttribute(name)] as const,
    );
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
    return () => {
      for (const [name, value] of previous) {
        // A command menu may have taken ownership since this picker opened.
        if (
          root.getAttribute(name) !==
          attributes[name as keyof typeof attributes]
        )
          continue;
        if (value === null) root.removeAttribute(name);
        else root.setAttribute(name, value);
      }
    };
  }, [editor, id, open, selected]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const row =
      selected === null
        ? null
        : menu?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    if (!menu || !row) return;
    const outer = menu.getBoundingClientRect();
    const inner = row.getBoundingClientRect();
    if (inner.top < outer.top) menu.scrollTop -= outer.top - inner.top;
    else if (inner.bottom > outer.bottom)
      menu.scrollTop += inner.bottom - outer.bottom;
  }, [selected]);

  if (!open || !anchorElement) return null;
  return createPortal(
    <div className="chat-follow-up-menu">
      <div className="sr-only" role="status">
        {filteredSuggestions.length} suggested follow-ups available. Use arrow
        keys to navigate, Enter to insert, or Escape to dismiss.
      </div>
      <div
        id={id}
        role="listbox"
        aria-label="Suggested follow-ups"
        ref={menuRef}
        className="chat-follow-up-options"
      >
        {filteredSuggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            role="option"
            tabIndex={-1}
            id={`${id}-${index}`}
            data-index={index}
            aria-selected={selected === index}
            onPointerDown={(event) => event.preventDefault()}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setSelected(index)}
            onClick={() => accept(index)}
          >
            <CornerDownLeft
              size={14}
              aria-hidden
              className="chat-follow-up-icon"
            />
            <span>{suggestion.text}</span>
          </button>
        ))}
      </div>
    </div>,
    anchorElement,
  );
}
