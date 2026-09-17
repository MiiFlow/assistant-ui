import type { MediaChunkData } from "../types";
import { MarkdownMediaContext } from "./markdown/media-references";
import { useContext, useMemo, useRef } from "react";
import { ChatRenderContext } from "../context/ChatProvider";
import { usePrefersReducedMotion } from "../hooks/use-reduced-motion";
import { cn } from "../utils/cn";
import { ListUnwrapContext } from "./markdown/components";
import { MarkdownBlock } from "./markdown/MarkdownBlock";
import { MarkdownRenderContext, type MarkdownRenderContextValue } from "./markdown/render-context";
import { repairTail } from "./markdown/repair";
import { splitBlocks } from "./markdown/split-blocks";

export interface MarkdownContentProps {
	medias?: readonly MediaChunkData[];
	/** Markdown content to render */
	children: string;
	/** Additional CSS classes */
	className?: string;
	/** Base font size multiplier for responsive scaling */
	baselineFontSize?: number;
	/** Use dark theme for code blocks. Falls back to the host surface's
	 * `isDarkSurface` from ChatProvider. */
	darkCodeTheme?: boolean;
	/** The text is still growing. The unterminated tail of the last block is
	 *  repaired (an open `**` or fence is closed) so the styled form appears
	 *  from the first token, and newly arrived words fade in. */
	isStreaming?: boolean;
	/** Per-word mount fade on the live block. Only honoured while
	 *  `isStreaming`; reduced-motion viewers never get it. Default true. */
	animateText?: boolean;
}

/**
 * Markdown renderer for chat messages.
 *
 * The document is split into top-level blocks (`splitBlocks`) and each block
 * is a memoised `MarkdownBlock`. While an answer streams only the last block
 * re-parses; a finished block above it keeps its DOM nodes untouched. When
 * the stream ends the same string yields the same blocks, so completion
 * changes nothing on screen — the exact opposite of the previous renderer,
 * which re-parsed and remounted the whole document on every delta and again
 * at completion.
 *
 * Block keys are positional on purpose. Streamed text only appends, so block
 * `i` is stable once block `i+1` exists; a content-derived key would remount
 * the live block on every token. The one case where an earlier block re-keys
 * is when a new line reclassifies it (a paragraph becoming a table or a
 * setext heading), and that block should re-render.
 *
 * A tight list is one `<ul>`/`<ol>` built here around per-item blocks (see
 * `splitBlocks`), so a growing list re-parses only its last item.
 *
 * The word fade stays on a block once it has streamed. Its spans are inert
 * after their one-shot animation, and turning the plugin off at completion
 * would re-render that block without them — a rebuild of the whole live
 * block's DOM at the exact moment the answer lands, which is what completion
 * must not do. Blocks that never streamed (history) carry no spans.
 *
 * Trade-off: each block is parsed on its own, so markdown state that spans
 * blocks does not carry — reference-style link definitions and GFM footnotes
 * defined in a different block will not resolve. Assistants do not produce
 * either today.
 *
 * Appearance lives entirely in the `.chat-prose` rules in
 * `src/styles/prose.css`; the element overrides in `./markdown/components`
 * carry only behaviour. Keep it that way — the two used to be duplicated,
 * and because react-markdown v9 dropped the `className` prop the CSS half was
 * silently dead for the entire time both existed.
 */
export function MarkdownContent({
	children,
	medias,
	className,
	baselineFontSize,
	darkCodeTheme,
	isStreaming = false,
	animateText = true,
}: MarkdownContentProps) {
	// `ChatRenderContext` carries only the render inputs (chip resolver,
	// surface theme). It deliberately does NOT carry the message list, which
	// changes on every streamed token and would re-render every message body
	// in the transcript per delta if read from here.
	const render = useContext(ChatRenderContext);
	const reducedMotion = usePrefersReducedMotion();

	// The host app owns this: chat-ui is themed through `--chat-*` variables
	// and consumers do not reliably apply a `.dark` class, so neither can be
	// read from here. `prefers-color-scheme` used to be the fallback, which
	// rendered dark code blocks in a light app on a dark OS.
	const useDarkCode = darkCodeTheme ?? render?.isDarkSurface ?? false;
	// Optional chip resolver from ChatProvider. Used to swap chip ids like
	// `ad_acct_…` for the human-friendly account name and platform logo at
	// render time — the wire format only carries `<id>:<kind>`. Undefined
	// outside a chat context (e.g. MarkdownContent inside a card
	// visualization).
	const resolveCommandToken = render?.resolveCommandToken;

	const renderContext = useMemo<MarkdownRenderContextValue>(
		() => ({ resolveCommandToken, useDarkCode }),
		[resolveCommandToken, useDarkCode],
	);

	// One font-size declaration on the wrapper; everything inside is sized in
	// `em` so it scales with a branding override instead of needing the value
	// stamped onto every element.
	const rootStyle = baselineFontSize != null ? { fontSize: `${baselineFontSize}rem` } : undefined;

	const blocks = useMemo(() => splitBlocks(children), [children]);
	const last = blocks.length - 1;
	const animateLive = isStreaming && animateText && !reducedMotion;
	// Keys of the units that have streamed with the fade on; they keep it.
	const animatedKeys = useRef(new Set<string>());
	const animateFor = (key: string, live: boolean): boolean => {
		if (live && animateLive) animatedKeys.current.add(key);
		return animatedKeys.current.has(key);
	};

	return (
		<MarkdownMediaContext.Provider value={medias || []}>
		<MarkdownRenderContext.Provider value={renderContext}>
			<div className={cn("chat-prose", className)} style={rootStyle}>
				{blocks.map((block, i) => {
					const isLastBlock = i === last;
					if (block.kind === "list") {
						const Tag = block.ordered ? "ol" : "ul";
						const lastItem = block.items.length - 1;
						return (
							<Tag key={i} start={block.ordered && block.start !== 1 ? block.start : undefined}>
								<ListUnwrapContext.Provider value={true}>
									{block.items.map((item, j) => {
										const live = isStreaming && isLastBlock && j === lastItem;
										const key = `${i}-${j}`;
										return (
											<MarkdownBlock
												key={key}
												source={live ? repairTail(item) : item}
												animate={animateFor(key, live)}
											/>
										);
									})}
								</ListUnwrapContext.Provider>
							</Tag>
						);
					}
					const live = isStreaming && isLastBlock;
					const key = String(i);
					return (
						<MarkdownBlock
							key={key}
							source={live ? repairTail(block.raw) : block.raw}
							animate={animateFor(key, live)}
						/>
					);
				})}
			</div>
		</MarkdownRenderContext.Provider>
		</MarkdownMediaContext.Provider>
	);
}
