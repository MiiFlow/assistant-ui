import type { Element, Root, RootContent, Text } from "hast";

/** Elements whose text must stay a single node: code is read back verbatim
 *  by the highlighter and the copy button, and SVG/math text is not prose. */
const SKIP = new Set(["pre", "code", "svg", "math", "script", "style", "textarea"]);

/** A word with its trailing whitespace, or a leading whitespace run. Joining
 *  the matches reproduces the input exactly, so nothing is lost or moved. */
const WORD_RE = /\S+\s*|\s+/g;

export const WORD_ATTR = "data-mf-word";

/**
 * Wrap every word of the tree in a `<span data-mf-word>`.
 *
 * Applied ONLY to the block that is still receiving text. React reconciles
 * the spans by position, so a word that was already on screen keeps its DOM
 * node and a word that just arrived mounts fresh and runs the `mf-word-in`
 * animation once. That is what turns a burst of tokens into a soft reveal
 * instead of a hard pop, with no timers and no artificial delay: the text is
 * on screen the moment it arrives.
 *
 * Finished blocks never see this plugin, so a finished answer carries no
 * extra markup at all.
 */
export function rehypeAnimateWords() {
	return (tree: Root) => {
		walk(tree);
	};
}

function walk(node: Root | Element): void {
	const next: RootContent[] = [];
	for (const child of node.children) {
		if (child.type === "element") {
			if (!SKIP.has(child.tagName)) walk(child);
			next.push(child);
		} else if (child.type === "text") {
			// Whitespace-only nodes are the newlines the markdown-to-HTML
			// transform leaves between block elements (<tr>s, <li>s). Wrapping
			// one puts a <span> where only a row or an item may go: React warns
			// and the browser invents an anonymous table cell around it.
			if (!/\S/.test(child.value)) {
				next.push(child);
				continue;
			}
			const words = child.value.match(WORD_RE);
			if (!words) continue;
			for (const word of words) {
				const text: Text = { type: "text", value: word };
				const span: Element = {
					type: "element",
					tagName: "span",
					properties: { [WORD_ATTR]: "" },
					children: [text],
				};
				next.push(span);
			}
		} else {
			next.push(child);
		}
	}
	node.children = next as typeof node.children;
}
