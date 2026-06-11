import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalComposerContext, useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { cn } from "../utils/cn";
import { CommandTokenNode, $isCommandTokenNode } from "./CommandTokenNode";
import { CommandTokenPlugin } from "./CommandTokenPlugin";
import type {
  ChatComposerSubmitPayload,
  ChatComposerToken,
  CommandProvider,
} from "./types";

const EDITOR_THEME = {
  paragraph: "chat-composer-paragraph",
};

export interface LexicalChatInputHandle {
  /** Clear the editor contents and reset history. */
  clear: () => void;
  /** Programmatically submit the current editor contents. */
  submit: () => void;
  /** Focus the editor. */
  focus: () => void;
  /**
   * Insert text at the caret (or at the end when there is no selection) and
   * focus the editor. Used by toolbar buttons to type trigger characters
   * like "/" or "@" so the matching typeahead opens.
   */
  insertText: (text: string) => void;
}

export interface LexicalChatInputProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Tailwind classes applied to the inner ContentEditable element. */
  inputClassName?: string;
  /** Tailwind classes applied to the placeholder overlay (e.g. font sizing). */
  placeholderClassName?: string;
  /** Slot for additional Lexical plugins (mounted inside LexicalComposer). */
  children?: ReactNode;
  /**
   * Called whenever the editor's plain-text projection changes. Use this to
   * gate a parent-rendered submit button on `text.trim().length > 0`.
   */
  onChange?: (payload: ChatComposerSubmitPayload) => void;
  /** Called when the user presses Enter (without Shift). */
  onSubmit: (payload: ChatComposerSubmitPayload) => void | Promise<void>;
  /**
   * Optional slash-command typeahead. When omitted, the editor behaves like
   * a plain rich-text input.
   */
  commandProvider?: CommandProvider | null;
  /**
   * Multiple typeahead providers, one per trigger character (e.g. `/` for
   * skills + modes, `@` for ad accounts). When supplied, this takes
   * precedence over the singular `commandProvider`. Each provider mounts its
   * own `CommandTokenPlugin` instance.
   */
  commandProviders?: CommandProvider[];
}

function readPayload(editor: LexicalEditor): ChatComposerSubmitPayload {
  let text = "";
  const tokens: ChatComposerToken[] = [];
  editor.getEditorState().read(() => {
    const root = $getRoot();
    text = root.getTextContent();
    const collect = (node: LexicalNode) => {
      if ($isCommandTokenNode(node)) {
        tokens.push({
          id: node.getCommandId(),
          kind: node.getCommandKind(),
          label: node.getCommandLabel(),
        });
      }
      if ($isElementNode(node)) {
        for (const child of node.getChildren()) collect(child);
      }
    };
    collect(root);
  });
  return { text, tokens };
}

export const LexicalChatInput = forwardRef<LexicalChatInputHandle, LexicalChatInputProps>(
  function LexicalChatInput(
    {
      placeholder = "Type a message...",
      disabled = false,
      className,
      inputClassName,
      placeholderClassName,
      children,
      onChange,
      onSubmit,
      commandProvider,
      commandProviders,
    },
    ref,
  ) {
    const initialConfig = useMemo(
      () => ({
        namespace: "ChatComposer",
        theme: EDITOR_THEME,
        nodes: [CommandTokenNode],
        editable: !disabled,
        onError: (error: Error) => {
          // eslint-disable-next-line no-console
          console.error("[chat-ui composer]", error);
        },
      }),
      // The initial config can't change after mount; `disabled` is applied via editor.setEditable below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <ChatInputBody
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          inputClassName={inputClassName}
          placeholderClassName={placeholderClassName}
          onChange={onChange}
          onSubmit={onSubmit}
          commandProvider={commandProvider}
          commandProviders={commandProviders}
          imperativeHandle={ref}
        >
          {children}
        </ChatInputBody>
      </LexicalComposer>
    );
  },
);

function ChatInputBody({
  placeholder,
  disabled,
  className,
  inputClassName,
  placeholderClassName,
  children,
  onChange,
  onSubmit,
  commandProvider,
  commandProviders,
  imperativeHandle,
}: LexicalChatInputProps & {
  imperativeHandle: React.ForwardedRef<LexicalChatInputHandle>;
}) {
  const [editor] = useLexicalComposerContext();
  const prefersReducedMotion = useReducedMotion();
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const commandMenuOpenRef = useRef(false);

  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const submit = useCallback(() => {
    const payload = readPayload(editor);
    if (payload.text.trim().length === 0 && payload.tokens.length === 0) return;
    void onSubmitRef.current(payload);
  }, [editor]);

  useImperativeHandle(
    imperativeHandle,
    () => ({
      clear: () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
      },
      submit,
      focus: () => editor.focus(),
      insertText: (text: string) => {
        editor.focus(() => {
          editor.update(() => {
            let selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              $getRoot().selectEnd();
              selection = $getSelection();
            }
            if ($isRangeSelection(selection)) {
              selection.insertText(text);
            }
          });
        });
      },
    }),
    [editor, submit],
  );

  // Intercept Enter (without Shift) and trigger submit, unless the
  // command-token typeahead menu is open — in which case the typeahead's
  // own LOW-priority handler takes the key to select an option.
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (commandMenuOpenRef.current) return false;
        const keyboard = event as KeyboardEvent | null;
        if (keyboard?.shiftKey) return false;
        keyboard?.preventDefault();
        submit();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, submit]);

  const handleCommandMenuStateChange = useCallback((isOpen: boolean) => {
    commandMenuOpenRef.current = isOpen;
  }, []);

  const handleChange = useCallback(
    (_state: EditorState) => {
      if (!onChange) return;
      const payload = readPayload(editor);
      onChange(payload);
    },
    [editor, onChange],
  );

  return (
    <div className={cn("relative w-full", className)}>
      {/* The placeholder is absolutely positioned; this wrapper (not the padded
          outer div) is its containing block so it overlays the editable text
          exactly, regardless of caller padding. */}
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "outline-none w-full text-sm leading-relaxed",
                "min-h-[24px] max-h-[200px] overflow-y-auto",
                "text-gray-900 dark:text-zinc-100",
                disabled && "opacity-50 cursor-not-allowed",
                inputClassName,
              )}
            />
          }
          placeholder={
            <div
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center overflow-hidden",
                "text-sm text-gray-400 dark:text-zinc-500 select-none",
                placeholderClassName,
              )}
            >
              {prefersReducedMotion ? (
                <span className="truncate">{placeholder}</span>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={placeholder}
                    className="truncate"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {placeholder}
                  </motion.span>
                </AnimatePresence>
              )}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <OnChangePlugin onChange={handleChange} />
      <HistoryPlugin />
      {(() => {
        // Plural takes precedence; fall back to singular for back-compat.
        // We mount one plugin per provider so different triggers (e.g. `/`
        // and `@`) can each fire their own typeahead. The menu-open ref is
        // shared so submit-on-Enter is gated whichever menu is open.
        const providers =
          commandProviders && commandProviders.length > 0
            ? commandProviders
            : commandProvider
            ? [commandProvider]
            : [];
        return providers.map((p, i) => (
          <CommandTokenPlugin
            key={`${p.trigger ?? "/"}-${i}`}
            commandProvider={p}
            onMenuStateChange={handleCommandMenuStateChange}
          />
        ));
      })()}
      {children}
    </div>
  );
}

// Re-export so consumers that mount their own LexicalComposer can grab the
// editor instance for advanced wiring.
export { useLexicalComposerContext, LexicalComposerContext };
