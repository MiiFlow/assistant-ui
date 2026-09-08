import { lexer, type Token, type Tokens } from "marked";

/** One separately rendered unit of a message body. */
export type MarkdownBlock =
	| { kind: "block"; raw: string }
	| {
			/** A tight list, rendered as one `<ul>`/`<ol>` whose items are
			 *  separately memoised units — a list is the commonest shape of an
			 *  answer, and as a single block every new item re-parsed all of them. */
			kind: "list";
			raw: string;
			ordered: boolean;
			start: number;
			/** Raw markdown of each item, in order. */
			items: string[];
	  };

/**
 * Split a markdown document into its top-level blocks.
 *
 * Each block is the raw source of one top-level `marked` token, so a table,
 * fenced code block or blockquote is one block. A TIGHT list is split one
 * level further, into its items: each item is parsed on its own (as a
 * one-item list whose outer element the renderer unwraps) inside a list
 * element the renderer builds, so while an answer streams a list only the
 * item still receiving text re-parses. A loose list (blank lines between
 * items) stays one block, because an item parsed alone cannot know the list
 * is loose and would drop the `<p>` wrapping the others have.
 *
 * `marked` is only the splitter. The blocks themselves are still rendered by
 * react-markdown, so the markdown dialect a reader sees is unchanged.
 *
 * Blank-line tokens carry no content and are dropped.
 */
export function splitBlocks(markdown: string): MarkdownBlock[] {
	if (!markdown) return [];
	let tokens: Token[];
	try {
		tokens = lexer(markdown);
	} catch {
		// The lexer is a convenience, not a correctness gate: on any failure
		// fall back to rendering the document as one block.
		return [{ kind: "block", raw: markdown }];
	}
	const blocks: MarkdownBlock[] = [];
	for (const token of tokens) {
		if (token.type === "space") continue;
		if (!token.raw) continue;
		if (token.type === "list") {
			const list = token as Tokens.List;
			const items = list.items.map((item) => item.raw).filter((raw) => raw.length > 0);
			if (!list.loose && items.length > 1) {
				blocks.push({
					kind: "list",
					raw: token.raw,
					ordered: list.ordered,
					start: typeof list.start === "number" ? list.start : 1,
					items,
				});
				continue;
			}
		}
		blocks.push({ kind: "block", raw: token.raw });
	}
	return blocks.length > 0 ? blocks : [{ kind: "block", raw: markdown }];
}
