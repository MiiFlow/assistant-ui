/**
 * Suggested next messages, written by the agent inline in its answer:
 *
 *     <next-message actual="Break the spend down by campaign">By campaign</next-message>
 *
 * The label is what the reader sees; `actual` is what one click sends as the
 * user's next message (the label itself when `actual` is left out). An agent
 * opts in through its own prompt. The server's half of the contract is
 * `server/assistant/services/next_message_links.py`; both grammars run the
 * shared cases in `next-message.cases.json`. One element sits on one line,
 * with double-quoted attributes (a value may hold `>`) and a plain-text label
 * that runs up to the closing tag (so it may hold `<`, as in "CPA < $40"). A
 * model sometimes drops the closing tag; the label then runs to the end of its
 * line, so the suggestion still reads as a link instead of a raw tag.
 */

export const NEXT_MESSAGE_TAG = "next-message";

// One double-quoted attribute value, quotes included.
const VALUE = `"[^"\\n]*"`;
const ATTRIBUTES = `(?:\\s+[a-z-]+=${VALUE})*\\s*`;
const OPEN_SOURCE = `<${NEXT_MESSAGE_TAG}(${ATTRIBUTES})>`;
const CLOSE = `</${NEXT_MESSAGE_TAG}>`;
// A label: anything on the line up to the closing tag.
const LABEL = `(?:(?!${CLOSE})[^\\n])*`;

/** Exactly one opening tag; group 1 is its attribute run. */
export const NEXT_MESSAGE_OPEN_REGEX = new RegExp(`^${OPEN_SOURCE}$`);
export const NEXT_MESSAGE_CLOSE_REGEX = new RegExp(`^${CLOSE}$`);

// The tail of a streaming text that is still becoming an element. Rendered
// as-is, the raw tag would show for a few tokens and then turn into a link:
// `<` or `<next-mes` (a name prefix), `<next-message actual="Brea` (an open
// tag whose attributes are still arriving), or a whole open tag followed by
// a label not yet closed (a partial closing tag included). A complete element
// never matches, so text after one is never trimmed.
const prefixes = (word: string) => Array.from({ length: word.length }, (_, i) => word.slice(0, i + 1));
const PARTIAL_ATTRIBUTE = `(?:\\s+[a-z-]*(?:=(?:"[^"\\n]*)?)?)?`;
const PARTIAL_TRAILING_REGEX = new RegExp(
	"<(?:" +
		[
			`(?:${prefixes(NEXT_MESSAGE_TAG).join("|")})?`,
			`${NEXT_MESSAGE_TAG}${ATTRIBUTES}${PARTIAL_ATTRIBUTE}`,
			`${NEXT_MESSAGE_TAG}${ATTRIBUTES}>${LABEL}`,
		].join("|") +
		")$",
);

const ENTITIES: Record<string, string> = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", "#39": "'" };

function decodeEntities(value: string): string {
	return value.replace(/&(quot|amp|lt|gt|apos|#39);/g, (_, name: string) => ENTITIES[name]);
}

/** `actual` from an opening tag's attribute run, decoded; undefined when absent. */
export function nextMessageActual(attributes: string): string | undefined {
	const match = new RegExp(`(?:^|\\s)actual=(${VALUE})`).exec(attributes);
	return match ? decodeEntities(match[1].slice(1, -1)) : undefined;
}

/** What a click sends: `actual`, else the label, whitespace collapsed. */
export function nextMessageText(actual: string | undefined, label: string): string {
	const text = actual?.trim() ? actual : label;
	return text.replace(/\s+/g, " ").trim();
}

// Code is shown as written, so a tag inside a fence or a code span (an answer
// explaining the syntax) stays. Matched first, then left alone.
const CODE = "(?<fence>```|~~~)[\\s\\S]*?(?:\\k<fence>|$(?![\\s\\S]))|`[^`\\n]+`";
const PLAIN_TEXT_SOURCE = `(?<code>${CODE})|${OPEN_SOURCE}(?<label>${LABEL})(?:${CLOSE}|(?=\\n)|$)`;

/** Every element outside code replaced by its label: the plain-text form of
 * an answer. */
export function stripNextMessages(content: string): string {
	return content.replace(new RegExp(PLAIN_TEXT_SOURCE, "gm"), (match: string, ...args: unknown[]) => {
		const groups = args[args.length - 1] as { code?: string; label?: string };
		return groups.code !== undefined ? match : decodeEntities(groups.label ?? "");
	});
}

/** Drop an unfinished trailing element from text that is still streaming;
 * it comes back whole, as a link, once its closing tag arrives. */
export function trimPartialTrailingNextMessage(content: string): string {
	return content.replace(PARTIAL_TRAILING_REGEX, "");
}
