import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { ReactNode } from "react";

import { CommandTokenView } from "./CommandTokenView";

export type SerializedCommandTokenNode = Spread<
  {
    commandId: string;
    commandKind: string;
    commandLabel: string;
    type: "command-token";
    version: 1;
  },
  SerializedLexicalNode
>;

const TOKEN_DATA_ATTR = "data-chat-command-token";

export class CommandTokenNode extends DecoratorNode<ReactNode> {
  __id: string;
  __kind: string;
  __label: string;

  constructor(id: string, kind: string, label: string, key?: NodeKey) {
    super(key);
    this.__id = id;
    this.__kind = kind;
    this.__label = label;
  }

  static getType(): string {
    return "command-token";
  }

  static clone(node: CommandTokenNode): CommandTokenNode {
    return new CommandTokenNode(node.__id, node.__kind, node.__label, node.__key);
  }

  static importJSON(serialized: SerializedCommandTokenNode): CommandTokenNode {
    return new CommandTokenNode(
      serialized.commandId,
      serialized.commandKind,
      serialized.commandLabel,
    );
  }

  exportJSON(): SerializedCommandTokenNode {
    return {
      ...super.exportJSON(),
      commandId: this.__id,
      commandKind: this.__kind,
      commandLabel: this.__label,
      type: "command-token",
      version: 1,
    };
  }

  getCommandId(): string {
    return this.__id;
  }

  getCommandKind(): string {
    return this.__kind;
  }

  getCommandLabel(): string {
    return this.__label;
  }

  /** Wire format. Backend parses `/${id}:${kind}` from the message body. */
  getEncodedText(): string {
    return `/${this.__id}:${this.__kind}`;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.setAttribute(TOKEN_DATA_ATTR, "true");
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute(TOKEN_DATA_ATTR, "true");
    element.setAttribute("data-command-id", this.__id);
    element.setAttribute("data-command-kind", this.__kind);
    element.textContent = this.getEncodedText();
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute(TOKEN_DATA_ATTR)) return null;
        return { conversion: convertCommandTokenElement, priority: 1 };
      },
    };
  }

  decorate(): ReactNode {
    return (
      <span contentEditable={false} style={{ userSelect: "none" }}>
        <CommandTokenView
          id={this.__id}
          kind={this.__kind}
          label={this.__label}
          variant="chip"
        />
      </span>
    );
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  /** Plain-text projection (clipboard, root.getTextContent, etc.). */
  getTextContent(): string {
    return this.getEncodedText();
  }
}

function convertCommandTokenElement(domNode: HTMLElement): DOMConversionOutput | null {
  const id = domNode.getAttribute("data-command-id");
  const kind = domNode.getAttribute("data-command-kind");
  if (!id || !kind) return null;
  const label = domNode.textContent?.replace(/^\//, "") ?? id;
  return { node: $createCommandTokenNode(id, kind, label) };
}

export function $createCommandTokenNode(
  id: string,
  kind: string,
  label: string,
): CommandTokenNode {
  return new CommandTokenNode(id, kind, label);
}

export function $isCommandTokenNode(
  node: LexicalNode | null | undefined,
): node is CommandTokenNode {
  return node instanceof CommandTokenNode;
}

/**
 * Matches `/<id>:<kind>` substrings emitted by `CommandTokenNode.getEncodedText()`.
 *
 * Bounded by start-of-string, whitespace, or an opening bracket on the left,
 * and end-of-string, whitespace, or punctuation on the right — so it doesn't
 * fire on URLs like `https://example.com/path:foo`.
 *
 * The id capture allows spaces (skill names may have them); the kind capture
 * is restricted to word characters.
 */
export const COMMAND_TOKEN_REGEX =
  /(^|\s|\(|\[)\/([^\n:]+?):(\w+)(?=$|[\s.,!?)\]])/g;

export interface InlineCommandTokenMatch {
  id: string;
  kind: string;
  /** The full matched substring including the leading `/` (no leading boundary). */
  raw: string;
  /** Index in the original string where the leading `/` sits. */
  index: number;
  /** End index (exclusive) of the matched token. */
  endIndex: number;
}

/**
 * Find all `/id:kind` tokens in a plain-text string.
 *
 * Returns matches in document order. Use this when rendering message
 * history to replace token substrings with a visual chip.
 */
export function findInlineCommandTokens(text: string): InlineCommandTokenMatch[] {
  const matches: InlineCommandTokenMatch[] = [];
  COMMAND_TOKEN_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COMMAND_TOKEN_REGEX.exec(text)) !== null) {
    const leading = m[1] ?? "";
    const id = m[2];
    const kind = m[3];
    const start = m.index + leading.length;
    const raw = m[0].slice(leading.length);
    matches.push({ id, kind, raw, index: start, endIndex: start + raw.length });
  }
  return matches;
}
