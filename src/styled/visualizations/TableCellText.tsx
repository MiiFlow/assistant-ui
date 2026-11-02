import type { ReactNode } from "react";
import { EntityText } from "../markdown/entity-references";

// A markdown link "[label](url)" with an http(s) URL. The model sometimes
// writes one into a "string" column instead of using a "link" column, which
// showed the raw markdown in the table (V3-BUG-320). The URL may hold one
// level of parentheses (".../wiki/Foo_(bar)"). Image syntax "![alt](url)" is
// not a link and stays text.
const MARKDOWN_LINK =
  /(?<!!)\[([^[\]\n]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/gi;

/** The href for a markdown link target, or null unless it is http(s). */
function markdownLinkHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    if (!parsed.hostname) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * A string table cell: markdown links to http(s) URLs render as anchors that
 * open in a new tab; everything else (including links with any other scheme,
 * such as javascript:) stays text, with entity ids rendered by EntityText.
 */
export function TableCellText({
  children,
  linkClassName,
}: {
  children: string;
  linkClassName?: string;
}) {
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of children.matchAll(MARKDOWN_LINK)) {
    const href = markdownLinkHref(match[2]);
    if (!href) continue;
    const index = match.index ?? 0;
    if (index > end)
      parts.push(
        <EntityText key={`t${end}`}>{children.slice(end, index)}</EntityText>,
      );
    parts.push(
      <a
        key={`l${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={
          linkClassName ?? "text-blue-500 dark:text-blue-400 hover:underline"
        }
      >
        {match[1]}
      </a>,
    );
    end = index + match[0].length;
  }
  if (!parts.length) return <EntityText>{children}</EntityText>;
  if (end < children.length)
    parts.push(<EntityText key={`t${end}`}>{children.slice(end)}</EntityText>);
  return <>{parts}</>;
}
