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
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  $createCommandTokenNode,
  $isCommandTokenNode,
} from "./CommandTokenNode";
import { DefaultCommandMenu } from "./DefaultCommandMenu";
import type { ChatComposerCommand, CommandProvider } from "./types";

const DEFAULT_TRIGGER = "/";
const QUERY_LENGTH_LIMIT = 75;

class CommandTypeaheadOption extends MenuOption {
  command: ChatComposerCommand;
  retry: boolean;

  constructor(command: ChatComposerCommand, retry = false) {
    super(`${command.kind}:${command.id}`);
    this.command = command;
    this.retry = retry;
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
   * default themed picker (use this to render a host-specific menu).
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
  onMenuStateChange?: (isOpen: boolean, trigger: string) => void;
}

export function CommandTokenPlugin({
  commandProvider,
  menuRenderer,
  onMenuStateChange,
}: CommandTokenPluginProps): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [results, setResults] = useState<ChatComposerCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);

  const trigger = commandProvider?.trigger ?? DEFAULT_TRIGGER;
  const triggerRegex = useMemo(() => buildTriggerRegex(trigger), [trigger]);

  useEffect(() => {
    onMenuStateChange?.(open, trigger);
    return () => onMenuStateChange?.(false, trigger);
  }, [open, trigger, onMenuStateChange]);

  useEffect(() => {
    setResults([]);
    setFetchError(undefined);
    if (
      !commandProvider ||
      queryString == null
    ) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // The promise boundary also catches a synchronous provider failure.
    Promise.resolve()
      .then(() => commandProvider.fetch(queryString))
      .then((result) => {
        if (!cancelled) {
          setResults(Array.isArray(result) ? result : result.commands);
          setFetchError(Array.isArray(result) ? undefined : result.error);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchError("Could not load options. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [commandProvider, queryString, attempt]);

  const error =
    commandProvider?.error ||
    fetchError;
  const pending = loading || Boolean(commandProvider?.loading);
  const retryLoad = useCallback(() => {
    commandProvider?.retry?.();
    setAttempt((value) => value + 1);
  }, [commandProvider]);
  const options = useMemo(
    () => [
      ...(error ? [new CommandTypeaheadOption(
        { id: "retry", kind: "action", label: "Try again" }, true,
      )] : []),
      ...results.map((cmd) => new CommandTypeaheadOption(cmd)),
    ],
    [results, error],
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
      if (selectedOption.retry) {
        retryLoad();
        return;
      }
      editor.update(() => {
        const kind = selectedOption.command.kind;
        const isSingleton = singletonKinds?.includes(kind) ?? false;

        if (isSingleton) {
          // Remove any existing chip of the same kind. Walking once with a
          // collected list (rather than mutating during traversal) keeps the
          // tree stable while we iterate.
          const stale: {
            node: ReturnType<typeof $createCommandTokenNode>;
            index: number;
          }[] = [];
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
    [editor, trigger, singletonKinds, retryLoad],
  );

  if (!commandProvider) return null;

  return (
    <LexicalTypeaheadMenuPlugin<CommandTypeaheadOption>
      onQueryChange={setQueryString}
      onOpen={() => setOpen(true)}
      onClose={() => {
        setOpen(false);
        setQueryString(null);
      }}
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
                options: options.map((option) => option.command),
                selectedIndex: selectedIndex ?? 0,
                setSelectedIndex: setHighlightedIndex,
                selectOption: (option) => {
                  const match = options.find(
                    (o) =>
                      o.command.id === option.id &&
                      o.command.kind === option.kind,
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
            options={options.map((option) => option.command)}
            selectedIndex={selectedIndex ?? 0}
            setHighlightedIndex={setHighlightedIndex}
            onSelect={(index) => selectOptionAndCleanUp(options[index])}
            queryString={queryString}
            editorElement={editor.getRootElement()}
            trigger={trigger}
            loading={pending}
            error={error}
          />
        );
      }}
    />
  );
}
