import { useState, useEffect } from "react";
import { Check, Copy, FileText } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { CodePreviewVisualizationData, VisualizationConfig } from "../../types";

export interface CodePreviewVisualizationProps {
  data: CodePreviewVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
}

const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript", ts: "typescript", jsx: "jsx", tsx: "tsx",
  py: "python", rb: "ruby", rs: "rust", go: "go",
  java: "java", cpp: "cpp", c: "c", cs: "csharp",
  sh: "bash", bash: "bash", sql: "sql", html: "html",
  css: "css", json: "json", yaml: "yaml", yml: "yaml",
  xml: "xml", md: "markdown", graphql: "graphql",
};

export function CodePreviewVisualization({ data }: CodePreviewVisualizationProps) {
  const { code, language, lineNumbers = true, highlightLines = [], startLine = 1 } = data;
  const [copied, setCopied] = useState(false);

  const normalizedLanguage = LANGUAGE_MAP[language.toLowerCase()] || language.toLowerCase();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch { /* noop */ }
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const lineProps = (lineNumber: number) => {
    const style: React.CSSProperties = {};
    if (highlightLines.includes(lineNumber)) {
      style.backgroundColor = "rgba(59, 130, 246, 0.1)";
      style.display = "block";
      style.borderLeft = "3px solid #3B82F6";
      style.paddingLeft = "8px";
      style.marginLeft = "-11px";
    }
    return { style };
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-gray-400" />
          <span className="text-xs font-mono text-gray-400 lowercase">{normalizedLanguage}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200"
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={normalizedLanguage}
        style={oneDark}
        showLineNumbers={lineNumbers}
        startingLineNumber={startLine}
        wrapLines={true}
        lineProps={lineProps}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: "0.8125rem",
          lineHeight: "1.6",
          background: "#1e1e1e",
        }}
        codeTagProps={{
          style: { fontFamily: "'Fira Code', 'JetBrains Mono', monospace" },
        }}
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  );
}
