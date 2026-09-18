import { useContext, type MouseEvent, type ReactNode } from "react";
import { CommandTokenView } from "../../composer/CommandTokenView";
import { ChatRenderContext } from "../../context/ChatProvider";
import { MarkdownRenderContext } from "./render-context";

/**
 * Entity references: an assistant's mention of a host-side object (a
 * schedule, a workflow run, a report…) rendered as a named, navigable token.
 *
 * The canonical wire form is an ordinary Markdown link whose destination
 * carries the `entity:` scheme:
 *
 *     [Weekly digest](entity:schedule/sched_Ab3…)
 *
 * The host's server writes that form into persisted answers, so any Markdown
 * renderer shows the label and this package only has to dispatch on the
 * scheme. What the package does NOT know is what a kind means, where it
 * lives, or what to show on hover — that is the host's `resolveEntity`, the
 * same seam `resolveCommandToken` uses for `@` chips.
 *
 * Bare ids (`sched_Ab3…` outside any link) are the pre-canonical form: an
 * answer still streaming, or a message persisted before the host linked
 * them. When the host supplies `entityPrefixes` (prefix → kind) the remark
 * plugin below promotes those to the same `entity:` link so both forms
 * render through one component. Without the map, bare ids stay text.
 */

export const ENTITY_HREF_SCHEME = "entity:";

/** The parts of an `entity:<kind>/<id>` destination. */
export interface EntityReferenceInfo {
	kind: string;
	id: string;
	/** The link's own text — the host-baked label, or the bare id. */
	label: string;
}

/** What the host supplies for one reference. Every field optional: a host
 * that only knows the label still gets a chip; one that also knows the
 * route gets a link; one with a hover card gets that too. */
export interface EntityResolution {
	label?: string;
	/** Replaces the default uppercase kind pill (e.g. a kind icon). */
	icon?: ReactNode;
	href?: string;
	/** In-app navigation. When set, a click calls this instead of following
	 * `href`; `href` is still rendered so the link is inspectable/copyable. */
	onNavigate?: () => void;
	/** Wrap the chip (`trigger`) in a hover card. */
	renderHoverCard?: (trigger: ReactNode) => ReactNode;
}

export type EntityResolver = (ref: EntityReferenceInfo) => EntityResolution | undefined;

/** `entity:<kind>/<id>` → `{ kind, id }`, or null for anything else. The id
 * is opaque here; the kind is one path segment. */
export function parseEntityHref(href: string | undefined | null): { kind: string; id: string } | null {
	if (!href || !href.startsWith(ENTITY_HREF_SCHEME)) return null;
	const rest = href.slice(ENTITY_HREF_SCHEME.length);
	const slash = rest.indexOf("/");
	if (slash <= 0 || slash === rest.length - 1) return null;
	const kind = rest.slice(0, slash);
	const id = rest.slice(slash + 1);
	if (!/^[a-z][a-z0-9_]*$/.test(kind) || !/^[A-Za-z0-9_]+$/.test(id)) return null;
	return { kind, id };
}

export function entityHref(kind: string, id: string): string {
	return `${ENTITY_HREF_SCHEME}${kind}/${id}`;
}

// The id body every host-side token id carries after its prefix: 24 base62
// characters. The host declares the prefixes; the body shape is the one
// thing the package pins, so a prefix can never match a longer word that
// merely starts the same way.
const ID_BODY = "[A-Za-z0-9]{24}";

interface EntityIdRegexes {
	/** Global: every bare id in a run of text. */
	inline: RegExp;
	/** Anchored: a string that is exactly one id (an inline code span). */
	whole: RegExp;
}

const regexCache = new WeakMap<Record<string, string>, EntityIdRegexes | null>();

/** The regexes for a prefix map: longest prefix first so `sched_run_` wins
 * over `sched_`. Null when the map declares no usable prefix. Cached per map
 * identity — the host hands the same object on every render. */
export function entityIdRegexes(prefixes: Record<string, string>): EntityIdRegexes | null {
	const cached = regexCache.get(prefixes);
	if (cached !== undefined) return cached;
	const keys = Object.keys(prefixes)
		.filter((p) => /^[A-Za-z0-9_]+_$/.test(p))
		.sort((a, b) => b.length - a.length);
	const alternation = keys.map(escapeRegex).join("|");
	const regexes = keys.length
		? {
				inline: new RegExp(`(?<![A-Za-z0-9_/=])(${alternation})(${ID_BODY})(?![A-Za-z0-9_])`, "g"),
				whole: new RegExp(`^(${alternation})(${ID_BODY})$`),
			}
		: null;
	regexCache.set(prefixes, regexes);
	return regexes;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface MdastNode {
	type: string;
	value?: string;
	url?: string;
	children?: MdastNode[];
	position?: unknown;
}

/**
 * remark plugin: promote bare ids to `entity:` links.
 *
 * Text nodes are split on registered-prefix ids; an inline code span that is
 * exactly one id becomes a link too (the model often backticks ids, and the
 * host's server links those at finalize, so the streaming preview should
 * agree). Fenced code, existing links and images are never entered — an id
 * inside a code block or a URL is literal.
 */
export function remarkEntityReferences(options?: { prefixes?: Record<string, string> }) {
	const prefixes = options?.prefixes;
	const regexes = prefixes ? entityIdRegexes(prefixes) : null;
	return (tree: MdastNode) => {
		if (!regexes || !prefixes) return;
		const { inline, whole } = regexes;
		// A match is (prefix, body); the id the host knows is their concatenation.
		const link = (prefix: string, body: string): MdastNode => ({
			type: "link",
			url: entityHref(prefixes[prefix], prefix + body),
			children: [{ type: "text", value: prefix + body }],
		});
		const walk = (node: MdastNode) => {
			if (!node.children) return;
			if (node.type === "link" || node.type === "linkReference" || node.type === "image") return;
			node.children = node.children.flatMap((child) => {
				if (child.type === "inlineCode" && typeof child.value === "string") {
					const m = whole.exec(child.value);
					return m ? [link(m[1], m[2])] : [child];
				}
				if (child.type !== "text" || typeof child.value !== "string") {
					walk(child);
					return [child];
				}
				const parts: MdastNode[] = [];
				let end = 0;
				for (const match of child.value.matchAll(inline)) {
					const index = match.index ?? 0;
					if (index > end) parts.push({ type: "text", value: child.value.slice(end, index) });
					parts.push(link(match[1], match[2]));
					end = index + match[0].length;
				}
				if (!parts.length) return [child];
				if (end < child.value.length) parts.push({ type: "text", value: child.value.slice(end) });
				return parts;
			});
		};
		walk(tree);
	};
}

// Humanise a wire kind for the default pill: `report_document` → `report document`.
function kindLabel(kind: string): string {
	return kind.replace(/_/g, " ");
}

/**
 * One rendered entity reference. Reads the host resolver from the render
 * context; renders a chip either way, so an unresolved reference (no host
 * resolver, unknown kind) still reads as the named thing rather than as a
 * dead link or a raw id.
 */
/** The host's entity inputs, wherever the caller sits: inside a Markdown
 * body (`MarkdownRenderContext`) or in a visualization rendered beside one
 * (`ChatRenderContext`). The Markdown context wins because `MarkdownContent`
 * copies the chat values into it; either alone is enough. */
export function useEntityRenderInputs(): {
	resolveEntity?: EntityResolver;
	entityPrefixes?: Record<string, string>;
} {
	const markdown = useContext(MarkdownRenderContext);
	const chat = useContext(ChatRenderContext);
	return {
		resolveEntity: markdown.resolveEntity ?? chat?.resolveEntity,
		entityPrefixes: markdown.entityPrefixes ?? chat?.entityPrefixes,
	};
}

export function EntityReference({ kind, id, label }: EntityReferenceInfo) {
	const { resolveEntity } = useEntityRenderInputs();
	const resolved = resolveEntity?.({ kind, id, label });
	const text = resolved?.label || label || id;
	const chip = (
		<CommandTokenView
			id={id}
			kind={kindLabel(kind)}
			label={text}
			tag={resolved?.icon}
			variant="chip"
		/>
	);
	const href = resolved?.href;
	const onNavigate = resolved?.onNavigate;
	const onClick = onNavigate
		? (event: MouseEvent<HTMLAnchorElement>) => {
				// Plain click navigates in-app; modified clicks (new tab, etc.)
				// keep the browser's own behaviour on `href`.
				if (event.defaultPrevented || event.button !== 0) return;
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				event.preventDefault();
				onNavigate();
			}
		: undefined;
	const trigger =
		href || onNavigate ? (
			<a
				href={href ?? "#"}
				onClick={onClick}
				data-entity-kind={kind}
				data-entity-id={id}
				className="chat-entity-ref"
				style={{ textDecoration: "none", color: "inherit" }}
			>
				{chip}
			</a>
		) : (
			<span data-entity-kind={kind} data-entity-id={id} className="chat-entity-ref">
				{chip}
			</span>
		);
	return resolved?.renderHoverCard ? <>{resolved.renderHoverCard(trigger)}</> : trigger;
}

/**
 * Plain text with its entity ids rendered as chips — for values that are
 * data, not Markdown: a visualization's table cell, a KPI's label, a card's
 * line. The host's server records those ids in the message's
 * `entity_references` (so `resolveEntity` can supply the name); the split
 * here is the same one the remark plugin applies to a text node. Without a
 * prefix map the text renders as-is.
 */
export function EntityText({ children }: { children: string }) {
	const { entityPrefixes } = useEntityRenderInputs();
	const regexes = entityPrefixes ? entityIdRegexes(entityPrefixes) : null;
	if (!regexes || !entityPrefixes || !children) return <>{children}</>;
	const parts: ReactNode[] = [];
	let end = 0;
	for (const match of children.matchAll(regexes.inline)) {
		const index = match.index ?? 0;
		if (index > end) parts.push(children.slice(end, index));
		const id = match[1] + match[2];
		parts.push(<EntityReference key={`${index}-${id}`} kind={entityPrefixes[match[1]]} id={id} label={id} />);
		end = index + match[0].length;
	}
	if (!parts.length) return <>{children}</>;
	if (end < children.length) parts.push(children.slice(end));
	return <>{parts}</>;
}
