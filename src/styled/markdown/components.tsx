import {
	Children,
	Fragment,
	cloneElement,
	createContext,
	isValidElement,
	useCallback,
	useContext,
	useState,
	type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { CommandTokenView } from "../../composer/CommandTokenView";
import { findInlineCommandTokens } from "../../composer/CommandTokenNode";
import { MarkdownRenderContext, type CommandTokenResolver } from "./render-context";

/**
 * The markdown element overrides, defined ONCE at module scope.
 *
 * Every component here reads its per-instance inputs (chip resolver, code
 * theme) from `MarkdownRenderContext` rather than from props closed over by
 * the parent. That is the whole point of this file: a `components` map built
 * inline in the parent's render gives React a new component type for every
 * element on every render, and React answers a new type with an unmount and a
 * remount of the subtree. During streaming that meant the entire answer was
 * torn down and rebuilt on every delta.
 *
 * Appearance lives in `src/styles/prose.css`; the overrides carry behaviour
 * only (heading anchors, the code-block copy button, inline command-token
 * chips, the image-URL swap).
 */

// `singleTilde: false` because remark-gfm defaults it to TRUE, which GitHub
// itself does not: `~text~` becomes <del>. Assistants write `~` for
// "approximately" constantly, so any answer with two of them struck out
// everything between them. Only `~~text~~` should strike.
export const REMARK_PLUGINS = [[remarkGfm, { singleTilde: false }], remarkBreaks] as const;

// Chip kinds that are routing/behavior signals — not content. We strip them
// from the rendered message so the bubble shows the user's words, not the
// scaffolding. Visible kinds (ad-account, guideline) describe the scope or
// reference material attached to the question — meaningful context the user
// wants to see in their own bubble after sending.
const HIDDEN_CHIP_KINDS = new Set<string>(["mode", "skill"]);

function splitTextWithCommandTokens(text: string, resolve?: CommandTokenResolver): ReactNode[] {
	const matches = findInlineCommandTokens(text);
	if (matches.length === 0) return [text];
	const parts: ReactNode[] = [];
	let cursor = 0;
	matches.forEach((m, i) => {
		if (m.index > cursor) parts.push(text.slice(cursor, m.index));
		if (HIDDEN_CHIP_KINDS.has(m.kind)) {
			// Skip emitting a chip. Also consume one trailing space so we don't
			// leave a double-space ("hello  world") where the chip used to sit.
			cursor = m.endIndex;
			if (text[cursor] === " ") cursor += 1;
			return;
		}
		const resolved = resolve?.(m.id, m.kind);
		parts.push(
			<CommandTokenView
				key={`tok-${i}`}
				id={m.id}
				kind={m.kind}
				label={resolved?.label}
				tag={resolved?.tag}
				variant="chip"
			/>,
		);
		cursor = m.endIndex;
	});
	if (cursor < text.length) parts.push(text.slice(cursor));
	return parts;
}

/**
 * Recursively walk children of a markdown-rendered element, splitting any
 * string descendants on `/id:kind` matches and replacing matches with
 * `CommandTokenView`. Non-text children (e.g. <code>, <a>, <strong>) are
 * preserved as-is so markdown formatting still works.
 */
export function processInlineCommandTokens(
	children: ReactNode,
	resolve?: CommandTokenResolver,
): ReactNode {
	return Children.map(children, (child, idx) => {
		if (typeof child === "string") {
			const parts = splitTextWithCommandTokens(child, resolve);
			if (parts.length === 1 && parts[0] === child) return child;
			return <Fragment key={`text-${idx}`}>{parts}</Fragment>;
		}
		if (isValidElement(child)) {
			// Don't descend into code spans / pre — tokens inside literal code
			// should render verbatim.
			const type = child.type as { name?: string; displayName?: string } | string | undefined;
			const tagName = typeof type === "string" ? type : undefined;
			if (tagName === "code" || tagName === "pre") return child;
			const childChildren = (child.props as { children?: ReactNode }).children;
			if (childChildren == null) return child;
			return cloneElement(child, undefined, processInlineCommandTokens(childChildren, resolve));
		}
		return child;
	});
}

/**
 * The plain text of a rendered subtree.
 *
 * `String(children)` was enough while children were bare strings. The
 * word-fade plugin wraps each word in a span, so a heading's children become
 * elements and `String()` would read `[object Object]`. Walk instead.
 */
export function textOf(node: ReactNode): string {
	if (node == null || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (isValidElement(node)) {
		return textOf((node.props as { children?: ReactNode }).children);
	}
	return "";
}

const LANGUAGE_MAP: Record<string, string> = {
	js: "javascript",
	ts: "typescript",
	jsx: "jsx",
	tsx: "tsx",
	py: "python",
	rb: "ruby",
	rs: "rust",
	go: "go",
	java: "java",
	cpp: "cpp",
	c: "c",
	cs: "csharp",
	swift: "swift",
	kt: "kotlin",
	php: "php",
	sql: "sql",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	shell: "bash",
	html: "html",
	css: "css",
	scss: "scss",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	xml: "xml",
	md: "markdown",
	graphql: "graphql",
	dockerfile: "docker",
	toml: "toml",
};

function normalizeLanguage(lang: string): string {
	return LANGUAGE_MAP[lang.toLowerCase()] || lang.toLowerCase();
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.trim();
}

/** Hover-revealed deep link rendered inside a heading. */
function HeadingAnchor({ id, size }: { id: string; size: number }) {
	return (
		<a href={`#${id}`} className="chat-prose__anchor" aria-label="Link to heading">
			<LinkIcon size={size} className="inline" />
		</a>
	);
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Fallback: noop
		}
	}, [text]);

	return (
		<button
			onClick={handleCopy}
			className="chat-code-block__copy"
			aria-label={copied ? "Copied" : "Copy code"}
		>
			{copied ? <Check size={14} /> : <Copy size={14} />}
			{copied ? "Copied" : "Copy"}
		</button>
	);
}

type WithChildren = { children?: ReactNode };

/**
 * True while rendering ONE item of a split list (`splitBlocks`): the item's
 * own outer `<ul>`/`<ol>` is dropped so the `<li>` lands inside the list
 * element `MarkdownContent` built around all the items. Reset to false for
 * anything nested inside the item, so a sub-list renders normally.
 */
export const ListUnwrapContext = createContext(false);

function useResolver(): CommandTokenResolver | undefined {
	return useContext(MarkdownRenderContext).resolveCommandToken;
}

function Heading({
	level,
	anchorSize,
	children,
}: WithChildren & { level: 1 | 2 | 3; anchorSize: number }) {
	const resolve = useResolver();
	const id = slugify(textOf(children));
	const Tag = `h${level}` as const;
	return (
		<Tag id={id} className="group">
			{processInlineCommandTokens(children, resolve)}
			<HeadingAnchor id={id} size={anchorSize} />
		</Tag>
	);
}

function H1({ children }: WithChildren) {
	return <Heading level={1} anchorSize={16}>{children}</Heading>;
}
function H2({ children }: WithChildren) {
	return <Heading level={2} anchorSize={14}>{children}</Heading>;
}
function H3({ children }: WithChildren) {
	return <Heading level={3} anchorSize={12}>{children}</Heading>;
}
function H4({ children }: WithChildren) {
	const resolve = useResolver();
	return <h4>{processInlineCommandTokens(children, resolve)}</h4>;
}
function P({ children }: WithChildren) {
	const resolve = useResolver();
	return <p>{processInlineCommandTokens(children, resolve)}</p>;
}
function Li({ children }: WithChildren) {
	const resolve = useResolver();
	return <li>{processInlineCommandTokens(children, resolve)}</li>;
}
function Blockquote({ children }: WithChildren) {
	const resolve = useResolver();
	return <blockquote>{processInlineCommandTokens(children, resolve)}</blockquote>;
}
function Th({ children }: WithChildren) {
	const resolve = useResolver();
	return <th>{processInlineCommandTokens(children, resolve)}</th>;
}
function Td({ children }: WithChildren) {
	const resolve = useResolver();
	return <td>{processInlineCommandTokens(children, resolve)}</td>;
}

function Anchor({ href, children }: WithChildren & { href?: string }) {
	const isImageUrl = href && /\.(png|jpe?g|gif|webp|svg)([?#]|$)/i.test(href);
	if (isImageUrl) {
		return <img src={href} alt={textOf(children)} loading="lazy" />;
	}
	return (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	);
}

function Code({ className, children }: WithChildren & { className?: string }) {
	const { useDarkCode } = useContext(MarkdownRenderContext);
	const match = /language-(\w+)/.exec(className || "");
	const codeText = textOf(children).replace(/\n$/, "");
	const isInline = !match && !codeText.includes("\n");

	if (isInline) {
		return <code>{children}</code>;
	}

	const language = match ? normalizeLanguage(match[1]) : "text";

	return (
		/* `data-dark` keeps the whole block on ONE signal: the Prism theme
		   paints its own background, and the header tint below is keyed to
		   the same flag. Deriving the background from --chat-text instead
		   would let a light syntax theme land on a dark panel. */
		<div className="chat-code-block group" data-dark={useDarkCode ? "" : undefined}>
			<div className="chat-code-block__header">
				<span className="chat-code-block__lang">{language}</span>
				<CopyButton text={codeText} />
			</div>
			<SyntaxHighlighter
				language={language}
				style={useDarkCode ? oneDark : oneLight}
				customStyle={{
					margin: 0,
					borderRadius: 0,
					fontSize: "0.8125em",
					lineHeight: "1.6",
				}}
				codeTagProps={{ style: { fontFamily: "var(--chat-font-mono)" } }}
			>
				{codeText}
			</SyntaxHighlighter>
		</div>
	);
}

function Pre({ children }: WithChildren) {
	return <>{children}</>;
}
function Table({ children }: WithChildren) {
	return (
		<div className="chat-table-wrap">
			<table>{children}</table>
		</div>
	);
}
function Thead({ children }: WithChildren) {
	return <thead>{children}</thead>;
}
function Ul({ children }: WithChildren) {
	const unwrap = useContext(ListUnwrapContext);
	if (unwrap) return <ListUnwrapContext.Provider value={false}>{children}</ListUnwrapContext.Provider>;
	return <ul>{children}</ul>;
}
function Ol({ children }: WithChildren) {
	const unwrap = useContext(ListUnwrapContext);
	if (unwrap) return <ListUnwrapContext.Provider value={false}>{children}</ListUnwrapContext.Provider>;
	return <ol>{children}</ol>;
}
function Hr() {
	return <hr />;
}
function Strong({ children }: WithChildren) {
	return <strong>{children}</strong>;
}
function Em({ children }: WithChildren) {
	return <em>{children}</em>;
}
function Img({ src, alt }: { src?: string | Blob; alt?: string }) {
	// React 19 types `src` as `string | Blob`; markdown only ever yields a string.
	return <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />;
}

export const COMPONENTS: Components = {
	h1: H1,
	h2: H2,
	h3: H3,
	h4: H4,
	p: P,
	a: Anchor,
	ul: Ul,
	ol: Ol,
	li: Li,
	blockquote: Blockquote,
	code: Code,
	pre: Pre,
	table: Table,
	thead: Thead,
	th: Th,
	td: Td,
	hr: Hr,
	strong: Strong,
	em: Em,
	img: Img,
};
