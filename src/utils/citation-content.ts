/**
 * Parses a citation's `full_content` into a readable payload plus metadata.
 *
 * The server stores the tool's readable text when it can find one, but older
 * rows (and dict-shaped tool results without a recognised key) carry a Python
 * repr: `{'handle': 'x', 'status': 'completed', 'answer': '…'}` with escaped
 * newlines and repr-chosen quote styles. Rendering that verbatim is how the
 * citation modal ended up showing a dict dump; this unpicks it.
 */

export interface ParsedCitationContent {
	/** The readable payload, with escapes resolved, ready for markdown. */
	text: string;
	/** Remaining top-level scalar fields, in document order. */
	meta: [string, string][];
}

/** Keys that carry the human-readable payload, in priority order.
 *  Mirrors the server's list in citation_processor.py, with "answer" first. */
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

/** Python string-literal escapes → real characters. Unknown escapes keep
 *  their backslash, matching Python's own tolerance. */
function unescapePy(value: string): string {
	return value.replace(/\\(.)/g, (match, ch: string) => {
		switch (ch) {
			case "n":
				return "\n";
			case "t":
				return "\t";
			case "r":
				return "\r";
			case "'":
				return "'";
			case '"':
				return '"';
			case "\\":
				return "\\";
			default:
				return match;
		}
	});
}

/** A repr/JSON string value with its outer quotes removed and escapes resolved. */
function decodeQuoted(raw: string): string {
	const inner = raw.slice(1, -1);
	return unescapePy(inner);
}

const QUOTED = `'(?:\\\\.|[^'\\\\])*'|"(?:\\\\.|[^"\\\\])*"`;
const SCALAR = `${QUOTED}|True|False|None|-?[\\d.]+`;

function metaFromRepr(repr: string, skipKey: string): [string, string][] {
	const meta: [string, string][] = [];
	const re = new RegExp(`'(\\w+)':\\s*(${SCALAR})`, "g");
	let m: RegExpExecArray | null;
	while ((m = re.exec(repr)) !== null) {
		const [, key, rawValue] = m;
		if (key === skipKey) continue;
		const value =
			rawValue.startsWith("'") || rawValue.startsWith('"')
				? decodeQuoted(rawValue)
				: rawValue;
		if (value && value !== "None") meta.push([key, value]);
	}
	return meta;
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
 * content is just plain text (the caller renders it as-is).
 */
export function parseCitationContent(raw: string): ParsedCitationContent | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	// JSON first: cheap, and the strict parse tells us it really is JSON.
	if (trimmed.startsWith("{")) {
		try {
			const obj = JSON.parse(trimmed) as unknown;
			if (obj && typeof obj === "object" && !Array.isArray(obj)) {
				const record = obj as Record<string, unknown>;
				const key = readableKeyOf(record);
				if (key) {
					return {
						text: record[key] as string,
						meta: metaFromObject(record, key),
					};
				}
			}
		} catch {
			// Not JSON — likely a Python repr. Fall through.
		}
	}

	// Python repr: {'key': 'value', ...} with escaped newlines inside values.
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		const keyAlt = READABLE_KEYS.join("|");
		const mainRe = new RegExp(`'(${keyAlt})':\\s*(${QUOTED})`);
		const main = mainRe.exec(trimmed);
		if (!main) return null;
		return {
			text: decodeQuoted(main[2]),
			meta: metaFromRepr(trimmed, main[1]),
		};
	}

	return null;
}

/** Render `[ref:label]` markers as inline code, so they read as compact
 *  reference chips in markdown instead of bracketed noise. */
export function citationTextToMarkdown(text: string): string {
	return text.replace(/\[ref:([\w-]+)\]/g, "`$1`");
}
