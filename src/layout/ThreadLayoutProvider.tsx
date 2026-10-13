import {
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useState,
	type ReactNode,
} from "react";
import { classifyTier, deriveTier, type ThreadLayoutTier } from "./layout-tiers";

export interface ThreadLayoutValue {
	tier: ThreadLayoutTier;
	hostWidth: number;
}

const DEFAULT_THREAD_LAYOUT: ThreadLayoutValue = { tier: "wide", hostWidth: 0 };

const ThreadLayoutContext = createContext<ThreadLayoutValue>(DEFAULT_THREAD_LAYOUT);

export function useThreadLayout(): ThreadLayoutValue {
	return useContext(ThreadLayoutContext);
}

export interface ThreadLayoutProviderProps {
	children: ReactNode;
	/** Host element whose rendered width drives the tier (ChatLayout's root div). */
	host?: HTMLElement | null;
}

/**
 * Container-driven thread layout: classifies the chat host's rendered width
 * into a layout tier and republishes it through context. Renders no DOM.
 * Without ResizeObserver it classifies once from the viewport width.
 */
export function ThreadLayoutProvider({ children, host }: ThreadLayoutProviderProps) {
	const [layout, setLayout] = useState<ThreadLayoutValue>(DEFAULT_THREAD_LAYOUT);

	// Classify the first measurement synchronously (before paint, before the
	// observer's first entry) and without hysteresis, so a host mounting inside
	// the band gets a deterministic tier instead of inheriting the unmeasured
	// default — and a narrow host never flashes the wide side frame for a frame.
	useLayoutEffect(() => {
		if (!host) {
			return;
		}
		const width = host.getBoundingClientRect().width;
		if (width > 0) {
			setLayout({ tier: classifyTier(width), hostWidth: width });
		}
	}, [host]);

	useEffect(() => {
		if (!host) {
			return;
		}
		if (typeof ResizeObserver === "undefined") {
			const width = typeof window === "undefined" ? 0 : window.innerWidth;
			setLayout((previous) => ({ tier: deriveTier(width, previous.tier), hostWidth: width }));
			return;
		}
		let frame = 0;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				setLayout((previous) => ({ tier: deriveTier(width, previous.tier), hostWidth: width }));
			});
		});
		observer.observe(host);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [host]);

	return (
		<ThreadLayoutContext.Provider value={layout}>{children}</ThreadLayoutContext.Provider>
	);
}
