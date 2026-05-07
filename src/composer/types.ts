import type { ReactNode } from "react";

export interface ChatComposerCommand {
  /** Stable, slug-style identifier sent to the backend (e.g. "lead-gen"). */
  id: string;
  /** Category the backend uses to dispatch this command (e.g. "skill", "mode"). */
  kind: string;
  /** Display title in the typeahead row and the inserted chip. */
  label: string;
  /** Optional secondary text shown in the typeahead row. */
  description?: string;
  /** Optional leading icon for the typeahead row and chip. */
  icon?: ReactNode;
  /** Extra keywords used by callers when filtering; not enforced by the package. */
  keywords?: string[];
}

export interface ChatComposerToken {
  id: string;
  kind: string;
  label: string;
}

export interface CommandProvider {
  /** Trigger character for typeahead. Defaults to "/". */
  trigger?: string;
  /**
   * Resolve commands for the current query (text after the trigger). Called
   * on every query change while the menu is open.
   */
  fetch: (query: string) => ChatComposerCommand[] | Promise<ChatComposerCommand[]>;
  /**
   * Chip kinds that should have at most one instance per message. Picking
   * a chip of a singleton kind removes any prior chip of the same kind from
   * the editor before inserting the new one. Kinds not listed here stack
   * (e.g. multiple `@ad-account` mentions in one message).
   */
  singletonKinds?: string[];
}

export interface ChatComposerSubmitPayload {
  /**
   * Plain-text projection of the editor. Each command token contributes
   * `/${id}:${kind}` so the backend can parse it from the message body.
   */
  text: string;
  /** Tokens present in the editor in document order. */
  tokens: ChatComposerToken[];
}
