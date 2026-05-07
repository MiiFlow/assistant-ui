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
    /** Trigger character that produced the chip (e.g. "/" or "@"). Optional in
     * v1 payloads — defaulted to "/" on import for backwards compatibility. */
    commandPrefix?: string;
    type: "command-token";
    version: 1 | 2;
  },
  SerializedLexicalNode
>;

const TOKEN_DATA_ATTR = "data-chat-command-token";
const DEFAULT_PREFIX = "/";

export class CommandTokenNode extends DecoratorNode<ReactNode> {
  __id: string;
  __kind: string;
  __label: string;
  __prefix: string;

  constructor(
    id: string,
    kind: string,
    label: string,
    prefix: string = DEFAULT_PREFIX,
    key?: NodeKey,
  ) {
    super(key);
    this.__id = id;
    this.__kind = kind;
    this.__label = label;
    this.__prefix = prefix;
  }

  static getType(): string {
    return "command-token";
  }

  static clone(node: CommandTokenNode): CommandTokenNode {
    return new CommandTokenNode(
      node.__id,
      node.__kind,
      node.__label,
      node.__prefix,
      node.__key,
    );
  }

  static importJSON(serialized: SerializedCommandTokenNode): CommandTokenNode {
    return new CommandTokenNode(
      serialized.commandId,
      serialized.commandKind,
      serialized.commandLabel,
      serialized.commandPrefix ?? DEFAULT_PREFIX,
    );
  }

  exportJSON(): SerializedCommandTokenNode {
    return {
      ...super.exportJSON(),
      commandId: this.__id,
      commandKind: this.__kind,
      commandLabel: this.__label,
      commandPrefix: this.__prefix,
      type: "command-token",
      version: 2,
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

  getCommandPrefix(): string {
    return this.__prefix;
  }

  /** Wire format. Backend parses `<prefix><id>:<kind>` from the message body. */
  getEncodedText(): string {
    return `${this.__prefix}${this.__id}:${this.__kind}`;
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
    element.setAttribute("data-command-prefix", this.__prefix);
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
  const prefix = domNode.getAttribute("data-command-prefix") ?? DEFAULT_PREFIX;
  const label =
    domNode.textContent?.replace(new RegExp(`^[\\${prefix}]`), "") ?? id;
  return { node: $createCommandTokenNode(id, kind, label, prefix) };
}

export function $createCommandTokenNode(
  id: string,
  kind: string,
  label: string,
  prefix: string = DEFAULT_PREFIX,
): CommandTokenNode {
  return new CommandTokenNode(id, kind, label, prefix);
}

export function $isCommandTokenNode(
  node: LexicalNode | null | undefined,
): node is CommandTokenNode {
  return node instanceof CommandTokenNode;
}

/**
 * Matches `<prefix><id>:<kind>` substrings emitted by `CommandTokenNode.getEncodedText()`,
 * where `<prefix>` is `/` (skill / mode chips) or `@` (ad-account chips).
 *
 * Bounded by start-of-string, whitespace, or an opening bracket on the left,
 * and end-of-string, whitespace, or punctuation on the right — so it doesn't
 * fire on URLs like `https://example.com/path:foo` or emails like
 * `user@host.com:port`.
 *
 * The id capture allows spaces (skill names may have them); the kind capture
 * allows word chars and hyphens (e.g. `ad-account`).
 */
export const COMMAND_TOKEN_REGEX =
  /(^|\s|\(|\[)([/@])([^\n:]+?):([\w-]+)(?=$|[\s.,!?)\]])/g;

export interface InlineCommandTokenMatch {
  id: string;
  kind: string;
  /** Trigger character that introduced the chip (`/` or `@`). */
  prefix: string;
  /** The full matched substring including the leading prefix (no leading boundary). */
  raw: string;
  /** Index in the original string where the leading prefix sits. */
  index: number;
  /** End index (exclusive) of the matched token. */
  endIndex: number;
}

/**
 * Find all `<prefix><id>:<kind>` tokens in a plain-text string.
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
    const prefix = m[2];
    const id = m[3];
    const kind = m[4];
    const start = m.index + leading.length;
    const raw = m[0].slice(leading.length);
    matches.push({
      id,
      kind,
      prefix,
      raw,
      index: start,
      endIndex: start + raw.length,
    });
  }
  return matches;
}
