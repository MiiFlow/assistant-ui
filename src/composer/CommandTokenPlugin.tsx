import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextNode,
} from "lexical";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { $createCommandTokenNode, $isCommandTokenNode } from "./CommandTokenNode";
import { CommandTokenView } from "./CommandTokenView";
import type { ChatComposerCommand, CommandProvider } from "./types";

const DEFAULT_TRIGGER = "/";
const QUERY_LENGTH_LIMIT = 75;

class CommandTypeaheadOption extends MenuOption {
  command: ChatComposerCommand;

  constructor(command: ChatComposerCommand) {
    super(`${command.kind}:${command.id}`);
    this.command = command;
  }
}

function buildTriggerRegex(trigger: string): RegExp {
  // Escape the trigger char for use in a character class.
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match: leading boundary (start, whitespace, or open-paren), the trigger,
  // then up to QUERY_LENGTH_LIMIT chars that are not whitespace.
  return new RegExp(
    `(^|\\s|\\()(${escaped}((?:[^${escaped}\\s]){0,${QUERY_LENGTH_LIMIT}}))$`,
  );
}

export interface CommandTokenPluginProps {
  /** The data source for the typeahead. When null, the plugin is inert. */
  commandProvider?: CommandProvider | null;
  /**
   * Optional override for the typeahead UI. When supplied, replaces the
   * default Tailwind popover (use this to render an MUI/host-themed menu).
   */
  menuRenderer?: (params: {
    anchorElement: HTMLElement | null;
    options: ChatComposerCommand[];
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
    selectOption: (option: ChatComposerCommand) => void;
    closeMenu: () => void;
  }) => React.ReactNode;
  /**
   * Notified whenever the typeahead menu opens or closes. Use this to gate
   * keyboard handlers (e.g. don't submit on Enter while the menu is open).
   */
  onMenuStateChange?: (isOpen: boolean) => void;
}

export function CommandTokenPlugin({
  commandProvider,
  menuRenderer,
  onMenuStateChange,
}: CommandTokenPluginProps): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [results, setResults] = useState<ChatComposerCommand[]>([]);

  const trigger = commandProvider?.trigger ?? DEFAULT_TRIGGER;
  const triggerRegex = useMemo(() => buildTriggerRegex(trigger), [trigger]);

  useEffect(() => {
    onMenuStateChange?.(queryString != null);
  }, [queryString, onMenuStateChange]);

  useEffect(() => {
    if (!commandProvider || queryString == null) {
      setResults([]);
      return;
    }
    let cancelled = false;
    Promise.resolve(commandProvider.fetch(queryString)).then((cmds) => {
      if (!cancelled) setResults(cmds);
    });
    return () => {
      cancelled = true;
    };
  }, [commandProvider, queryString]);

  const options = useMemo(
    () => results.map((cmd) => new CommandTypeaheadOption(cmd)),
    [results],
  );

  const checkForMatch = useCallback(
    (text: string): MenuTextMatch | null => {
      const match = triggerRegex.exec(text);
      if (!match) return null;
      const leading = match[1] ?? "";
      const matchingString = match[3] ?? "";
      return {
        leadOffset: match.index + leading.length,
        matchingString,
        replaceableString: match[2] ?? "",
      };
    },
    [triggerRegex],
  );

  const singletonKinds = commandProvider?.singletonKinds;

  const onSelectOption = useCallback(
    (
      selectedOption: CommandTypeaheadOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const kind = selectedOption.command.kind;
        const isSingleton = singletonKinds?.includes(kind) ?? false;

        if (isSingleton) {
          // Remove any existing chip of the same kind. Walking once with a
          // collected list (rather than mutating during traversal) keeps the
          // tree stable while we iterate.
          const stale: { node: ReturnType<typeof $createCommandTokenNode>; index: number }[] = [];
          const walk = (n: LexicalNode) => {
            if ($isCommandTokenNode(n) && n.getCommandKind() === kind) {
              stale.push({ node: n, index: 0 });
              return;
            }
            if ($isElementNode(n)) {
              for (const c of (n as ElementNode).getChildren()) walk(c);
            }
          };
          walk($getRoot());
          for (const entry of stale) {
            // If the chip is followed by a single space, drop that too so
            // we don't leave an orphan space where the chip used to sit.
            const next = entry.node.getNextSibling();
            entry.node.remove();
            if (next && $isTextNode(next)) {
              const nextText = next.getTextContent();
              if (nextText.startsWith(" ")) {
                const trimmed = nextText.slice(1);
                if (trimmed.length === 0) next.remove();
                else next.setTextContent(trimmed);
              }
            }
          }
        }

        const tokenNode = $createCommandTokenNode(
          selectedOption.command.id,
          kind,
          selectedOption.command.label,
          trigger,
        );
        const trailingSpace = $createTextNode(" ");
        if (nodeToReplace) {
          nodeToReplace.replace(tokenNode).insertAfter(trailingSpace);
        }
        trailingSpace.select();
        closeMenu();
      });
    },
    [editor, trigger, singletonKinds],
  );

  if (!commandProvider) return null;

  return (
    <LexicalTypeaheadMenuPlugin<CommandTypeaheadOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (menuRenderer) {
          return (
            <>
              {menuRenderer({
                anchorElement: anchorElementRef.current,
                options: results,
                selectedIndex: selectedIndex ?? 0,
                setSelectedIndex: setHighlightedIndex,
                selectOption: (option) => {
                  const match = options.find(
                    (o) => o.command.id === option.id && o.command.kind === option.kind,
                  );
                  if (match) selectOptionAndCleanUp(match);
                },
                closeMenu: () => setQueryString(null),
              })}
            </>
          );
        }
        return (
          <DefaultCommandMenu
            anchorElement={anchorElementRef.current}
            options={options}
            selectedIndex={selectedIndex ?? 0}
            setHighlightedIndex={setHighlightedIndex}
            selectOptionAndCleanUp={selectOptionAndCleanUp}
            visible={results.length > 0 || queryString != null}
            queryString={queryString}
          />
        );
      }}
    />
  );
}

function DefaultCommandMenu({
  anchorElement,
  options,
  selectedIndex,
  setHighlightedIndex,
  selectOptionAndCleanUp,
  visible,
  queryString,
}: {
  anchorElement: HTMLElement | null;
  options: CommandTypeaheadOption[];
  selectedIndex: number;
  setHighlightedIndex: (index: number) => void;
  selectOptionAndCleanUp: (option: CommandTypeaheadOption) => void;
  visible: boolean;
  queryString: string | null;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const VERTICAL_GAP = 6;

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || options.length === 0) return;
    const selectedEl = menu.querySelector<HTMLElement>(
      `#command-typeahead-item-${selectedIndex}`,
    );
    if (!selectedEl) return;
    const menuRect = menu.getBoundingClientRect();
    const itemRect = selectedEl.getBoundingClientRect();
    if (itemRect.top < menuRect.top) {
      menu.scrollTop -= menuRect.top - itemRect.top;
    } else if (itemRect.bottom > menuRect.bottom) {
      menu.scrollTop += itemRect.bottom - menuRect.bottom;
    }
  }, [selectedIndex, options.length]);

  useLayoutEffect(() => {
    if (!anchorElement || !visible || !menuRef.current) return;
    const reposition = () => {
      const menuEl = menuRef.current;
      if (!menuEl) return;
      const anchorRect = anchorElement.getBoundingClientRect();
      const menuHeight = menuEl.offsetHeight;
      const viewportHeight = window.innerHeight;
      // Lexical positions the anchor right below the cursor; anchorRect.top is
      // where the menu would render by default. anchorRect.height is the
      // cursor-line height (~20px), so the cursor's top is anchorRect.top - height.
      const spaceBelow = viewportHeight - anchorRect.top;
      const cursorTop = anchorRect.top - anchorRect.height;
      const spaceAbove = cursorTop;
      const wouldOverflowBottom = menuHeight + VERTICAL_GAP > spaceBelow;
      const fitsAbove = menuHeight + VERTICAL_GAP <= spaceAbove;
      setFlipped(wouldOverflowBottom && fitsAbove);
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchorElement, visible, options.length]);

  if (!anchorElement || !visible) return null;

  const anchorHeight = anchorElement.offsetHeight || 20;
  const transform = flipped
    ? `translateY(calc(-100% - ${anchorHeight + VERTICAL_GAP}px))`
    : "none";

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transform,
        zIndex: 99999,
        minWidth: 320,
        maxWidth: 520,
        maxHeight: 280,
        overflowY: "auto",
        borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.1)",
        background: "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        padding: 4,
        fontSize: 12,
        color: "#1f2937",
      }}
    >
      {options.length === 0 ? (
        <div style={{ padding: "6px 10px", fontSize: 11, color: "#6b7280" }}>
          No matching commands{queryString ? ` for "${queryString}"` : ""}
        </div>
      ) : (
        options.map((option, i) => {
          const isSelected = i === selectedIndex;
          const cmd = option.command;
          return (
            <CommandTokenView
              key={option.key}
              variant="row"
              id={cmd.id}
              kind={cmd.kind}
              label={cmd.label}
              description={cmd.description}
              icon={cmd.icon}
              selected={isSelected}
              htmlId={`command-typeahead-item-${i}`}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHighlightedIndex(i);
                selectOptionAndCleanUp(option);
              }}
            />
          );
        })
      )}
    </div>,
    anchorElement,
  );
}
