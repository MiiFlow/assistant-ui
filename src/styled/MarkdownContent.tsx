import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { cn } from "../utils/cn";

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
      className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200"
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
  /** Use dark theme for code blocks */
  darkCodeTheme?: boolean;
}

/**
 * Styled markdown renderer with syntax highlighting, copy-to-clipboard,
 * and heading anchor links.
 */
export function MarkdownContent({
  children,
  className,
  baselineFontSize = 1,
  darkCodeTheme,
}: MarkdownContentProps) {
  // Detect dark mode from CSS if not explicitly set
  const useDarkCode = darkCodeTheme ??
    (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  const fontStyle = baselineFontSize !== 1
    ? { fontSize: `${baselineFontSize}rem` }
    : undefined;

  return (
    <ReactMarkdown
      className={cn("chat-prose", className)}
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => {
          const text = String(children);
          const id = slugify(text);
          return (
            <h1 id={id} className="group text-2xl font-semibold mt-4 mb-2 first:mt-0" style={fontStyle}>
              {children}
              <a href={`#${id}`} className="ml-2 opacity-0 group-hover:opacity-50 transition-opacity" aria-label="Link to heading">
                <LinkIcon size={16} className="inline" />
              </a>
            </h1>
          );
        },
        h2: ({ children }) => {
          const text = String(children);
          const id = slugify(text);
          return (
            <h2 id={id} className="group text-xl font-semibold mt-3 mb-2 first:mt-0" style={fontStyle}>
              {children}
              <a href={`#${id}`} className="ml-2 opacity-0 group-hover:opacity-50 transition-opacity" aria-label="Link to heading">
                <LinkIcon size={14} className="inline" />
              </a>
            </h2>
          );
        },
        h3: ({ children }) => {
          const text = String(children);
          const id = slugify(text);
          return (
            <h3 id={id} className="group text-lg font-medium mt-2 mb-1 first:mt-0" style={fontStyle}>
              {children}
              <a href={`#${id}`} className="ml-2 opacity-0 group-hover:opacity-50 transition-opacity" aria-label="Link to heading">
                <LinkIcon size={12} className="inline" />
              </a>
            </h3>
          );
        },
        h4: ({ children }) => (
          <h4 className="text-base font-medium mt-2 mb-1 first:mt-0" style={fontStyle}>{children}</h4>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed" style={fontStyle}>{children}</p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:opacity-80 transition-opacity"
            style={fontStyle}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed" style={fontStyle}>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-2 italic text-chat-subtle" style={fontStyle}>
            {children}
          </blockquote>
        ),
        code: ({ className: codeClassName, children }) => {
          const match = /language-(\w+)/.exec(codeClassName || "");
          const codeText = String(children).replace(/\n$/, "");
          const isInline = !match && !codeText.includes("\n");

          if (isInline) {
            return (
              <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" style={fontStyle}>
                {children}
              </code>
            );
          }

          const language = match ? normalizeLanguage(match[1]) : "text";

          return (
            <div className="relative group my-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* Header with language badge and copy button */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
                <span className="text-xs font-mono text-gray-400">{language}</span>
                <CopyButton text={codeText} />
              </div>
              <SyntaxHighlighter
                language={language}
                style={useDarkCode === false ? oneLight : oneDark}
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: "0.8125rem",
                  lineHeight: "1.6",
                }}
                codeTagProps={{
                  style: { fontFamily: "'Fira Code', 'JetBrains Mono', monospace" },
                }}
              >
                {codeText}
              </SyntaxHighlighter>
            </div>
          );
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300" style={fontStyle}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700" style={fontStyle}>
            {children}
          </td>
        ),
        hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt ?? ""}
            className="max-w-full h-auto rounded-lg my-2"
            loading="lazy"
          />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
