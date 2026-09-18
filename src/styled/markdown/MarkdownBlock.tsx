import { memo, useContext } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { COMPONENTS, REMARK_PLUGINS } from "./components";
import { ENTITY_HREF_SCHEME, remarkEntityReferences } from "./entity-references";
import { rehypeAnimateWords } from "./rehype-animate-words";
import { MarkdownRenderContext } from "./render-context";

const ANIMATE_PLUGINS = [rehypeAnimateWords];
const NO_PLUGINS: never[] = [];

// The remark list with the entity plugin bound to the host's prefix map.
// Cached per map identity so the array is as stable as `REMARK_PLUGINS`
// itself; a host that supplies no map gets the shared base list.
const pluginsByPrefixes = new WeakMap<Record<string, string>, unknown[]>();
function remarkPluginsFor(prefixes: Record<string, string> | undefined): unknown[] {
	if (!prefixes) return REMARK_PLUGINS as unknown as unknown[];
	let list = pluginsByPrefixes.get(prefixes);
	if (!list) {
		list = [...REMARK_PLUGINS, [remarkEntityReferences, { prefixes }]];
		pluginsByPrefixes.set(prefixes, list);
	}
	return list;
}

// Custom schemes the renderer dispatches on. `media_ref:` is an image
// source, `entity:` a link destination; everything else goes through
// react-markdown's own allowlist.
function urlTransform(url: string, key: string): string {
	if (key === "src" && url.startsWith("media_ref:")) return url;
	if (key === "href" && url.startsWith(ENTITY_HREF_SCHEME)) return url;
	return defaultUrlTransform(url);
}

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
	const { entityPrefixes } = useContext(MarkdownRenderContext);
	return (
		<ReactMarkdown
			remarkPlugins={remarkPluginsFor(entityPrefixes) as never[]}
			rehypePlugins={animate ? ANIMATE_PLUGINS : NO_PLUGINS}
			components={COMPONENTS}
			urlTransform={urlTransform}
		>
			{source}
		</ReactMarkdown>
	);
}

export const MarkdownBlock = memo(MarkdownBlockInner);
