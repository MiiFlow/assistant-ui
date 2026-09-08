import { createContext, type ReactNode } from "react";

export type CommandTokenResolver = (
	id: string,
	kind: string,
) => { label?: string; tag?: ReactNode } | undefined;

/**
 * The per-instance inputs the module-level markdown components need.
 *
 * `MarkdownContent` used to hand these in by closing over them in a fresh
 * `components` map on every render. A fresh map means a fresh component
 * identity for every `<p>`, `<li>` and `<code>`, which React treats as a
 * different element type: the whole rendered answer was unmounted and
 * rebuilt on every streamed delta. Passing the inputs through context instead
 * lets the components be defined once at module scope.
 */
export interface MarkdownRenderContextValue {
	resolveCommandToken?: CommandTokenResolver;
	useDarkCode: boolean;
}

export const MarkdownRenderContext = createContext<MarkdownRenderContextValue>({
	useDarkCode: false,
});
