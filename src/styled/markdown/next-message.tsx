import { createContext, useContext } from "react";
import { CornerDownLeft } from "lucide-react";
import { NextMessageContext } from "../../context/ChatProvider";
import {
	NEXT_MESSAGE_CLOSE_REGEX,
	NEXT_MESSAGE_OPEN_REGEX,
	NEXT_MESSAGE_TAG,
	nextMessageActual,
	nextMessageText,
} from "../../utils/next-message";

/**
 * A suggested next message in an answer (grammar: `utils/next-message`),
 * rendered inline as its label over a solid bottom line, with a trailing
 * Enter icon: one click sends the message.
 *
 * Every settled assistant answer in a chat sends, including older answers.
 * Streaming answers send when the host queues; other hosts show plain labels
 * until the turn settles. Outside a chat (no `ChatProvider`, no message scope —
 * a card, a clarification panel) they are plain labels too.
 */

/** The id of the assistant answer being rendered; null for other messages
 * and outside `Message`. */
export const NextMessageScopeContext = createContext<string | null>(null);

interface MdastNode {
	type: string;
	value?: string;
	children?: MdastNode[];
	data?: { hName?: string; hProperties?: Record<string, unknown> };
}

function plainText(node: MdastNode): string {
	if (typeof node.value === "string") return node.value;
	return (node.children ?? []).map(plainText).join("");
}

/**
 * remark plugin: `<next-message …>label</next-message>` → one
 * `next-message` element carrying `actual` and the label as properties.
 *
 * Inline raw HTML reaches mdast as separate `html` nodes for the opening and
 * closing tags with the label between them; react-markdown would otherwise
 * print both tags as literal text. With no closing tag the label runs to the
 * line's end (a `break`, which `remarkBreaks` has already made of the
 * newline, or the end of the paragraph). The element is childless so later
 * plugins (entity linking) cannot turn part of a label into a chip.
 */
export function remarkNextMessages() {
	return (tree: MdastNode) => {
		const walk = (node: MdastNode) => {
			const children = node.children;
			if (!children) return;
			const out: MdastNode[] = [];
			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				const open = child.type === "html" ? NEXT_MESSAGE_OPEN_REGEX.exec(child.value ?? "") : null;
				if (!open) {
					walk(child);
					out.push(child);
					continue;
				}
				let end = i + 1;
				while (end < children.length && children[end].type !== "break") {
					const c = children[end];
					if (c.type === "html" && NEXT_MESSAGE_CLOSE_REGEX.test(c.value ?? "")) break;
					end++;
				}
				const closed = end < children.length && children[end].type === "html";
				const label = children.slice(i + 1, end).map(plainText).join("").trim();
				out.push({
					type: "nextMessage",
					data: {
						hName: NEXT_MESSAGE_TAG,
						hProperties: { actual: nextMessageActual(open[1]), label },
					},
				});
				// Past the closing tag; a line break stays for the next line.
				i = closed ? end : end - 1;
			}
			node.children = out;
		};
		walk(tree);
	};
}

/** The shown text split so its last word (its last character, for a label
 * with no spaces, as in Chinese) can stay on one line with the Enter icon:
 * otherwise a wrap can leave the icon alone at the start of the next line. */
function splitLastWord(text: string): [string, string] {
	const space = text.lastIndexOf(" ");
	if (space >= 0) return [text.slice(0, space + 1), text.slice(space + 1)];
	const chars = Array.from(text);
	return [chars.slice(0, -1).join(""), chars.slice(-1).join("")];
}

export function NextMessageLink({ actual, label = "" }: { actual?: string; label?: string }) {
	const scope = useContext(NextMessageScopeContext);
	const chat = useContext(NextMessageContext);
	const text = nextMessageText(actual, label);
	const live = !!text && !!chat?.canSend && scope !== null;
	if (!live) return <span className="chat-next-message">{label || text}</span>;
	const [head, tail] = splitLastWord(label || text);
	// A span, not a <button>: a button lays out as an inline block, so a long
	// label jumped to its own line and wrapped inside its box. This one wraps
	// with the sentence around it.
	return (
		<span
			role="button"
			tabIndex={0}
			className="chat-next-message"
			data-live=""
			title={text !== label ? text : undefined}
			onClick={() => chat.send(text)}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				chat.send(text);
			}}
		>
			{head}
			<span className="chat-next-message__tail">
				{tail}
				<CornerDownLeft aria-hidden className="chat-next-message__icon" />
			</span>
		</span>
	);
}
