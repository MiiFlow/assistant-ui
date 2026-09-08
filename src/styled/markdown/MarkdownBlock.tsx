import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { COMPONENTS, REMARK_PLUGINS } from "./components";
import { rehypeAnimateWords } from "./rehype-animate-words";

const ANIMATE_PLUGINS = [rehypeAnimateWords];
const NO_PLUGINS: never[] = [];

export interface MarkdownBlockProps {
	/** Raw markdown of ONE top-level block. */
	source: string;
	/** Fade newly arrived words in. Only ever true for the live block. */
	animate: boolean;
}

/**
 * One top-level block of a message body.
 *
 * Exported un-memoised so a test can wrap it in a spy; every real caller goes
 * through `MarkdownBlock`, whose `memo` is the mechanism that keeps a finished
 * block from re-parsing while the block below it streams. react-markdown
 * returns a fragment, so the block's elements land as direct children of the
 * `.chat-prose` wrapper and the prose CSS's `> :where(p, ul, …)` rules keep
 * matching.
 */
export function MarkdownBlockInner({ source, animate }: MarkdownBlockProps) {
	return (
		<ReactMarkdown
			remarkPlugins={REMARK_PLUGINS as unknown as never[]}
			rehypePlugins={animate ? ANIMATE_PLUGINS : NO_PLUGINS}
			components={COMPONENTS}
		>
			{source}
		</ReactMarkdown>
	);
}

export const MarkdownBlock = memo(MarkdownBlockInner);
