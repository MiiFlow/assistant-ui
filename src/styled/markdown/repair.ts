import remend from "remend";

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Repair the unterminated tail of a block that is still being streamed.
 *
 * A model writes `**bold` a few tokens before it writes the closing `**`.
 * Rendered as-is, the asterisks show literally and then the whole run
 * re-lays-out as bold when the close arrives. `remend` closes the open
 * syntax so the styled form appears from the first token and nothing
 * changes shape later.
 *
 * Fenced code is handled here rather than by remend: an open fence swallows
 * the rest of the document as code (that is what CommonMark says an
 * unterminated fence means), so the right preview is a code block that grows.
 * Appending the closing fence keeps it one, and lets the language badge and
 * highlighter apply from the first line instead of after the close.
 *
 * Only ever applied to the LAST block of a streaming document; every earlier
 * block is complete by construction.
 */
export function repairTail(block: string): string {
	const open = FENCE_OPEN.exec(block);
	if (open) {
		const fence = open[1];
		const closed = block
			.trimEnd()
			.split("\n")
			.slice(1)
			.some((line) => line.trimStart().startsWith(fence));
		if (closed) return block;
		return `${block.replace(/\n?$/, "\n")}${fence}`;
	}
	// `singleTilde: false` matches the remark-gfm configuration: a lone `~`
	// is "approximately", never strikethrough, so there is nothing to escape.
	return remend(block, { singleTilde: false });
}
