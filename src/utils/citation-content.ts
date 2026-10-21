/**
 * Parses a citation's `full_content` into a readable payload plus metadata.
 *
 * The server stores the tool's readable text when it can find one and JSON
 * for other dict or list results, but older rows carry a Python repr:
 * `{'handle': 'x', 'status': 'completed', 'answer': '…'}` with escaped
 * newlines and repr-chosen quote styles. Rendering that verbatim is how the
 * citation modal ended up showing a dict dump; this unpicks it.
 */

export interface ParsedCitationContent {
	/** The readable payload, with escapes resolved, ready for markdown. */
	text: string;
	/** Remaining top-level scalar fields, in document order. */
	meta: [string, string][];
}

/** Keys that carry the human-readable payload, in priority order. Must
 *  match READABLE_RESULT_KEYS in server/assistant/services/citation_processor.py,
 *  which picks the same field to store when the tool result is a dict. */
const READABLE_KEYS = [
	"answer",
	"text",
	"content",
	"result",
	"data",
	"summary",
	"output",
	"response",
];

/** Python/JSON string-literal escapes to real characters, including
 *  `\uXXXX`, `\UXXXXXXXX` and `\xNN`. Unknown escapes keep their backslash,
 *  matching Python's own tolerance. */
function unescapePy(value: string): string {
	return value.replace(
		/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|x[0-9a-fA-F]{2}|[\s\S])/g,
		(match, esc: string) => {
			if (esc.length > 1) {
				const code = Number.parseInt(esc.slice(1), 16);
				// \uXXXX halves of a surrogate pair concatenate back into one
				// character; a \U code point outside Unicode stays as written.
				if (esc[0] === "U") return code <= 0x10ffff ? String.fromCodePoint(code) : match;
				return String.fromCharCode(code);
			}
			switch (esc) {
				case "n":
					return "\n";
				case "t":
					return "\t";
				case "r":
					return "\r";
				case "b":
					return "\b";
				case "f":
					return "\f";
				case "'":
				case '"':
				case "\\":
				case "/":
					return esc;
				default:
					return match;
			}
		},
	);
}

function metaFromObject(obj: Record<string, unknown>, skipKey: string): [string, string][] {
	const meta: [string, string][] = [];
	for (const [key, value] of Object.entries(obj)) {
		if (key === skipKey || value === null || value === undefined) continue;
		if (typeof value === "string" && value) meta.push([key, value]);
		else if (typeof value === "number" || typeof value === "boolean") {
			meta.push([key, String(value)]);
		}
	}
	return meta;
}

function readableKeyOf(obj: Record<string, unknown>): string | undefined {
	return READABLE_KEYS.find((key) => typeof obj[key] === "string" && obj[key]);
}

/**
 * Parse `full_content` into payload + metadata, or return null when the
 * content is just plain text (the caller renders it as-is). A record or list
 * with no readable string field becomes a nested key/value list.
 */
export function parseCitationContent(raw: string): ParsedCitationContent | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	// JSON first: cheap, and the strict parse tells us it really is JSON. The
	// server stores structured tool results as JSON. JSON.parse rounds
	// integers past 2^53 (Meta object ids run to 18 digits), so text with a
	// long digit run goes to the literal parser below, which keeps them.
	if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && !LONG_DIGITS.test(trimmed)) {
		let json: unknown;
		try {
			json = JSON.parse(trimmed);
		} catch {
			// Not JSON (or JSON cut at the length cap): fall through.
		}
		if (json && typeof json === "object") return fromValue(json as Literal, false);
	}

	// A Python repr (older rows), or JSON cut at the length cap or holding a
	// long id. Only the top-level record's keys can be its readable field: a
	// nested 'text' belongs to a row, and picking it would flatten the rows.
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		const literal = parseLiteral(trimmed);
		if (literal) return fromValue(literal.value, literal.truncated);
	}

	return null;
}

/** Runs of digits long enough to exceed Number.MAX_SAFE_INTEGER. */
const LONG_DIGITS = /\d{16,}/;

/** A parsed record's readable field plus its scalar metadata, or else the
 *  whole value as a nested list. Nested lists and records beside the readable
 *  field are listed below its text rather than dropped. */
function fromValue(value: Literal, truncated: boolean): ParsedCitationContent | null {
	if (isRecord(value)) {
		const key = readableKeyOf(value);
		if (key) {
			const nested: { [key: string]: Literal } = Object.create(null);
			for (const [k, v] of Object.entries(value)) {
				if (k !== key && v !== null && typeof v === "object" && !isEmptyContainer(v)) nested[k] = v;
			}
			const list = structuredToMarkdown(nested);
			const text = value[key] as string;
			return { text: list ? `${text}\n\n${list}` : text, meta: metaFromObject(value, key) };
		}
	}
	return structured(value, truncated);
}

/** A parsed record or list as a nested markdown list; null when there is
 *  nothing to list, so the caller falls back to the stored text. */
function structured(value: Literal, truncated: boolean): ParsedCitationContent | null {
	if (value === null || typeof value !== "object") return null;
	const body = structuredToMarkdown(value);
	if (!body) return null;
	return { text: truncated ? `${body}\n\n…` : body, meta: [] };
}

type Literal = string | number | boolean | null | Literal[] | { [key: string]: Literal };

/** Keys that name a row, used to label each item of a list of records. */
const ROW_LABEL_KEYS = ["name", "title", "label", "display_name", "id"];

/** Sticky matchers for a number or a bare name at a given offset. */
const NUMBER_AT = /-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?(?![\w.])/iy;
const NAME_AT = /-?[A-Za-z_][\w.]*/y;

/** Nesting deeper than this renders inline instead of as another list level. */
const MAX_DEPTH = 6;

/** A string value the length cap cut: its text so far, shown with an ellipsis. */
class CutString {
	constructor(readonly text: string) {}
}

/** Closing bracket for each opener the source-text scanner tracks. */
const CLOSERS: Record<string, string> = { "(": ")", "[": "]", "{": "}", "<": ">" };

/** The text read so far of a string the cap cut, minus a half-read escape
 *  (`\`, `\u00`) or a lone surrogate half, with escapes resolved. */
function cutStringText(raw: string): string {
	const escape = /(\\+)(u[0-9a-fA-F]{0,3}|U[0-9a-fA-F]{0,7}|x[0-9a-fA-F]?)?$/.exec(raw);
	if (escape && escape[1].length % 2 === 1) raw = raw.slice(0, escape.index + escape[1].length - 1);
	const text = unescapePy(raw);
	return /[\ud800-\udbff]$/.test(text) ? text.slice(0, -1) : text;
}

/**
 * Parse a JSON value or a Python literal repr (dict, list, tuple, str,
 * number, True/False/None). A value it cannot read as a literal, such as a
 * set, `b'..'` bytes, a `<Obj at 0x..>` repr or a constructor call like
 * `Decimal('1.5')`, is kept as its source text, so one odd value never costs
 * the whole payload.
 *
 * The server caps `full_content` at a fixed length, so the repr can stop
 * mid-way: containers still open at the end are closed with what was read,
 * a string cut mid-way keeps its text with an ellipsis, an unfinished number,
 * word or key is dropped, and `truncated` says the end is missing without
 * an ellipsis to show it. Returns null when the text is not a literal at
 * all (plain prose that starts with a bracket, say).
 */
function parseLiteral(src: string): { value: Literal; truncated: boolean } | null {
	let pos = 0;
	let truncated = false;
	let cutInString = false;
	const EOF = Symbol("eof");
	type Parsed = Literal | typeof EOF | CutString;

	const skipSpace = () => {
		while (pos < src.length && /\s/.test(src[pos])) pos++;
	};

	const parseString = (): Parsed => {
		const quote = src[pos];
		let i = pos + 1;
		while (i < src.length && src[i] !== quote) i += src[i] === "\\" ? 2 : 1;
		if (i >= src.length) {
			const text = cutStringText(src.slice(pos + 1, Math.min(i, src.length)));
			pos = src.length;
			return text ? new CutString(text) : EOF;
		}
		const value = unescapePy(src.slice(pos + 1, i));
		pos = i + 1;
		return value;
	};

	/** The source text of a value up to the next `,` (or `:` for a key) or
	 *  the enclosing container's closer, skipping quoted and bracketed parts. */
	const sourceText = (inKey: boolean): Parsed => {
		const start = pos;
		const open: string[] = [];
		while (pos < src.length) {
			const ch = src[pos];
			if (ch === "'" || ch === '"') {
				if (typeof parseString() !== "string") return EOF;
				continue;
			}
			if (open.length === 0 && (ch === "," || ch === ")" || ch === "]" || ch === "}" || (inKey && ch === ":"))) {
				break;
			}
			// `<` opens only at the start (`<Obj at 0x..>`); elsewhere it may be a comparison.
			if (Object.prototype.hasOwnProperty.call(CLOSERS, ch) && (ch !== "<" || pos === start)) open.push(CLOSERS[ch]);
			else if (ch === open[open.length - 1]) open.pop();
			pos++;
		}
		if (pos >= src.length) return EOF;
		const text = src.slice(start, pos).trim();
		if (!text) throw new Error("not a literal");
		return text;
	};

	const parseWord = (): Parsed => {
		NUMBER_AT.lastIndex = pos;
		const number = NUMBER_AT.exec(src);
		if (number) {
			pos += number[0].length;
			// A number that runs into the end of the text was cut by the
			// length cap (1234 may have been 123456): drop it, never show it.
			if (pos >= src.length) return EOF;
			const value = Number(number[0]);
			// Integers past 2^53 lose digits as numbers; keep the source text.
			if (Number.isInteger(value) && !Number.isSafeInteger(value) && /^-?\d+$/.test(number[0])) {
				return number[0];
			}
			return value;
		}
		// Names: True/False/None, JSON's true/false/null, inf/nan, and the
		// head of a constructor call.
		NAME_AT.lastIndex = pos;
		const name = NAME_AT.exec(src);
		if (!name) throw new Error("not a literal");
		const word = name[0];
		pos += word.length;
		// Cut mid-word by the length cap (Tru, Non, Decim): drop it.
		if (pos >= src.length) return EOF;
		if (src[pos] === "'" || src[pos] === '"') {
			// u'..' is an ordinary string; b'..', r'..' and the rest are not
			// text as written, so they fall back to their source.
			if (word === "u" || word === "U") return parseString();
			throw new Error("prefixed string");
		}
		if (word === "True" || word === "true") return true;
		if (word === "False" || word === "false") return false;
		if (word === "None" || word === "null") return null;
		// A constructor call such as Decimal('1.5'): keep its source text.
		if (src[pos] === "(") {
			const start = pos - word.length;
			let depth = 0;
			while (pos < src.length) {
				const ch = src[pos];
				if (ch === "'" || ch === '"') {
					if (typeof parseString() !== "string") return EOF;
					continue;
				}
				pos++;
				if (ch === "(") depth++;
				else if (ch === ")" && --depth === 0) return src.slice(start, pos);
			}
			return EOF;
		}
		return word;
	};

	const parseContainer = (open: string): Parsed => {
		const close = open === "{" ? "}" : open === "[" ? "]" : ")";
		const isDict = open === "{";
		const list: Literal[] = [];
		// No prototype: a payload key such as "__proto__" stays an ordinary key.
		const dict: { [key: string]: Literal } = Object.create(null);
		const result = (): Literal => (isDict ? dict : list);
		// Cut at the cap: keep what was read, but a record or list cut before
		// its first entry finished has nothing to show, so it is dropped too.
		const cut = (): Parsed => {
			truncated = true;
			const empty = isDict ? Object.keys(dict).length === 0 : list.length === 0;
			return empty ? EOF : result();
		};
		const shown = (value: CutString): string => {
			cutInString = true;
			return `${value.text}…`;
		};
		pos++;
		for (;;) {
			skipSpace();
			if (pos >= src.length) {
				return cut();
			}
			if (src[pos] === close) {
				pos++;
				return result();
			}
			const first = parseValue(isDict);
			if (first === EOF) {
				return cut();
			}
			if (isDict) {
				// A key the cap cut is dropped with its missing value.
				if (first instanceof CutString) return cut();
				skipSpace();
				if (pos >= src.length) {
					return cut();
				}
				if (src[pos] !== ":") throw new Error("expected ':'");
				pos++;
				const value = parseValue(false);
				if (value === EOF) {
					return cut();
				}
				const key = typeof first === "string" ? first : formatScalar(first);
				if (value instanceof CutString) {
					dict[key] = shown(value);
					return cut();
				}
				dict[key] = value;
			} else if (first instanceof CutString) {
				list.push(shown(first));
				return cut();
			} else {
				list.push(first);
			}
			skipSpace();
			if (src[pos] === ",") pos++;
			else if (pos < src.length && src[pos] !== close) throw new Error("expected ','");
		}
	};

	const parseValue = (inKey: boolean): Parsed => {
		skipSpace();
		if (pos >= src.length) return EOF;
		const start = pos;
		try {
			const ch = src[pos];
			if (ch === "{" || ch === "[" || ch === "(") return parseContainer(ch);
			if (ch === "'" || ch === '"') return parseString();
			return parseWord();
		} catch {
			// Not a literal we read: keep this one value as its source text.
			pos = start;
			return sourceText(inKey);
		}
	};

	try {
		const value = parseValue(false);
		if (value === EOF || value instanceof CutString) return null;
		skipSpace();
		if (pos < src.length) return null;
		return { value, truncated: truncated && !cutInString };
	} catch {
		return null;
	}
}

function formatScalar(value: Literal): string {
	if (value === null) return "null";
	if (typeof value === "string") return value;
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function isRecord(value: Literal): value is { [key: string]: Literal } {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEmptyContainer(value: Literal): boolean {
	return Array.isArray(value) ? value.length === 0 : isRecord(value) && Object.keys(value).length === 0;
}

/** Bare URLs pass through unescaped so they stay clickable. */
const URL_SPLIT = /(https?:\/\/[^\s<>]+)/;
/** A line that markdown would read as a heading, quote, list item, rule or
 *  setext underline when it starts a list item's content. */
const BLOCK_START = /^(\s*)(#{1,6}(?=\s|$)|>|[-+*](?=\s|$)|\d+[.)](?=\s|$)|[-=_*]+\s*$)/;

/**
 * Tool payload keys and values are data, not markdown: escape what would
 * otherwise format (`*Promo*`, `# 1`, a key with `**`) so it reads literally.
 * `atLineStart` says the text opens a list item, where block syntax applies;
 * continuation lines always do.
 */
function escapeMarkdown(text: string, atLineStart: boolean): string {
	return text
		.split("\n")
		.map((line, index) => {
			const inline = line
				.split(URL_SPLIT)
				.map((part, i) => (i % 2 === 1 ? part : escapeInline(part)))
				.join("");
			if (index === 0 && !atLineStart) return inline;
			return inline.replace(BLOCK_START, (_m, space: string, marker: string) => `${space}\\${marker}`);
		})
		.join("\n");
}

function escapeInline(text: string): string {
	return text.replace(/[\\`*[\]<>~|_]/g, (ch, offset: number) => {
		// snake_case stays as typed: an underscore between word characters
		// never emphasises, so escaping it would only add noise to the source.
		if (ch === "_" && /\w/.test(text[offset - 1] ?? "") && /\w/.test(text[offset + 1] ?? "")) {
			return ch;
		}
		return `\\${ch}`;
	});
}

/** Inline code that survives backticks inside the value. */
function inlineCode(text: string): string {
	const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
	const fence = "`".repeat(longest + 1);
	return longest ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
}

/** One list item; continuation lines of a multi-line value stay inside it. */
function bullet(indent: string, text: string): string {
	return `${indent}- ${text.replace(/\n/g, `\n${indent}  `)}`;
}

function rowLabel(row: { [key: string]: Literal }, index: number): string {
	const key = ROW_LABEL_KEYS.find((k) => {
		const v = row[k];
		return (typeof v === "string" && v.trim()) || typeof v === "number";
	});
	return key ? formatScalar(row[key]) : String(index + 1);
}

/** Nested markdown list for a parsed record or list. */
function structuredToMarkdown(value: Literal, depth = 0): string {
	const indent = "  ".repeat(depth);
	const lines: string[] = [];
	const child = (rawLabel: string, inner: Literal) => {
		const label = escapeMarkdown(rawLabel, false);
		if (inner === null || typeof inner !== "object" || isEmptyContainer(inner)) {
			// Only strings carry tool text; numbers, null and [] / {} are safe.
			const scalar = formatScalar(inner);
			const shown = (atLineStart: boolean) =>
				typeof inner === "string" ? escapeMarkdown(scalar, atLineStart) : scalar;
			lines.push(bullet(indent, label ? `**${label}**: ${shown(false)}` : shown(true)));
		} else if (depth + 1 >= MAX_DEPTH) {
			lines.push(bullet(indent, `${label ? `**${label}**: ` : ""}${inlineCode(JSON.stringify(inner))}`));
		} else {
			lines.push(bullet(indent, `**${label}**`));
			lines.push(structuredToMarkdown(inner, depth + 1));
		}
	};
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			if (isRecord(item) && !isEmptyContainer(item)) child(rowLabel(item, index), item);
			else if (Array.isArray(item) && item.length > 0) child(String(index + 1), item);
			else child("", item);
		});
	} else if (isRecord(value)) {
		for (const [key, inner] of Object.entries(value)) child(key, inner);
	}
	return lines.join("\n");
}

/** Render `[ref:label]` markers as inline code, so they read as compact
 *  reference chips in markdown instead of bracketed noise. */
export function citationTextToMarkdown(text: string): string {
	return text.replace(/\[ref:([\w-]+)\]/g, "`$1`");
}
