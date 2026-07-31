import { Children, Fragment, isValidElement, cloneElement, useContext, useState, useCallback, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { CommandTokenView } from "../composer/CommandTokenView";
import { findInlineCommandTokens } from "../composer/CommandTokenNode";
import { ChatContext } from "../context/ChatProvider";
import { cn } from "../utils/cn";

type CommandTokenResolver = (
  id: string,
  kind: string,
) => { label?: string; tag?: ReactNode } | undefined;

// Chip kinds that are routing/behavior signals — not content. We strip them
// from the rendered message so the bubble shows the user's words, not the
// scaffolding.
//
// Visible kinds (ad-account, guideline) describe the scope or reference
// material attached to the question — that's meaningful context the user
// wants to see in their own bubble after sending.
const HIDDEN_CHIP_KINDS = new Set<string>(["mode", "skill"]);

function splitTextWithCommandTokens(
  text: string,
  resolve?: CommandTokenResolver,
): ReactNode[] {
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
 * `CommandTokenChip`. Non-text children (e.g. <code>, <a>, <strong>) are
 * preserved as-is so markdown formatting still works.
 */
function processInlineCommandTokens(
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

// Language alias mapping
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
    <a
      href={`#${id}`}
      className="chat-prose__anchor"
      aria-label="Link to heading"
    >
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

export interface MarkdownContentProps {
  /** Markdown content to render */
  children: string;
  /** Additional CSS classes */
  className?: string;
  /** Base font size multiplier for responsive scaling */
  baselineFontSize?: number;
  /** Use dark theme for code blocks. Falls back to the host surface's
   * `isDarkSurface` from ChatProvider. */
  darkCodeTheme?: boolean;
}

/**
 * Markdown renderer for chat messages.
 *
 * Appearance lives entirely in the `.chat-prose` rules in
 * `src/styles/prose.css`; the overrides below carry only behaviour (heading
 * anchors, the code-block copy button, inline command-token chips, and the
 * image-URL swap). Keep it that way — the two used to be duplicated, and
 * because react-markdown v9 dropped the `className` prop the CSS half was
 * silently dead for the entire time both existed.
 */
export function MarkdownContent({
  children,
  className,
  baselineFontSize,
  darkCodeTheme,
}: MarkdownContentProps) {
  const chat = useContext(ChatContext);

  // The host app owns this: chat-ui is themed through `--chat-*` variables
  // and consumers do not reliably apply a `.dark` class, so neither can be
  // read from here. `prefers-color-scheme` used to be the fallback, which
  // rendered dark code blocks in a light app on a dark OS.
  const useDarkCode = darkCodeTheme ?? chat?.isDarkSurface ?? false;

  // One font-size declaration on the wrapper; everything inside is sized in
  // `em` so it scales with a branding override instead of needing the value
  // stamped onto every element.
  const rootStyle = baselineFontSize != null
    ? { fontSize: `${baselineFontSize}rem` }
    : undefined;

  // Optional chip resolver from ChatProvider. Used to swap chip ids like
  // `ad_acct_…` for the human-friendly account name and platform logo at
  // render time — the wire format only carries `<id>:<kind>`. Undefined
  // outside a chat context (e.g. MarkdownContent inside a card
  // visualization).
  const resolveCommandToken = chat?.resolveCommandToken;

  return (
    <div className={cn("chat-prose", className)} style={rootStyle}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        h1: ({ children }) => {
          const id = slugify(String(children));
          return (
            <h1 id={id} className="group">
              {processInlineCommandTokens(children, resolveCommandToken)}
              <HeadingAnchor id={id} size={16} />
            </h1>
          );
        },
        h2: ({ children }) => {
          const id = slugify(String(children));
          return (
            <h2 id={id} className="group">
              {processInlineCommandTokens(children, resolveCommandToken)}
              <HeadingAnchor id={id} size={14} />
            </h2>
          );
        },
        h3: ({ children }) => {
          const id = slugify(String(children));
          return (
            <h3 id={id} className="group">
              {processInlineCommandTokens(children, resolveCommandToken)}
              <HeadingAnchor id={id} size={12} />
            </h3>
          );
        },
        h4: ({ children }) => (
          <h4>{processInlineCommandTokens(children, resolveCommandToken)}</h4>
        ),
        p: ({ children }) => (
          <p>{processInlineCommandTokens(children, resolveCommandToken)}</p>
        ),
        a: ({ href, children }) => {
          const isImageUrl = href && /\.(png|jpe?g|gif|webp|svg)([?#]|$)/i.test(href);
          if (isImageUrl) {
            return (
              <img
                src={href}
                alt={typeof children === "string" ? children : ""}
                loading="lazy"
              />
            );
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
        ul: ({ children }) => <ul>{children}</ul>,
        ol: ({ children }) => <ol>{children}</ol>,
        li: ({ children }) => <li>{processInlineCommandTokens(children, resolveCommandToken)}</li>,
        blockquote: ({ children }) => (
          <blockquote>{processInlineCommandTokens(children, resolveCommandToken)}</blockquote>
        ),
        code: ({ className: codeClassName, children }) => {
          const match = /language-(\w+)/.exec(codeClassName || "");
          const codeText = String(children).replace(/\n$/, "");
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
              {/* Header with language badge and copy button */}
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
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="chat-table-wrap">
            <table>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead>{children}</thead>,
        th: ({ children }) => (
          <th>{processInlineCommandTokens(children, resolveCommandToken)}</th>
        ),
        td: ({ children }) => (
          <td>{processInlineCommandTokens(children, resolveCommandToken)}</td>
        ),
        hr: () => <hr />,
        strong: ({ children }) => <strong>{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        img: ({ src, alt }) => <img src={src} alt={alt ?? ""} loading="lazy" />,
      }}
    >
      {children}
    </ReactMarkdown>
    </div>
  );
}
