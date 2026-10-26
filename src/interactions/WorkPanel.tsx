import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type UIEventHandler,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useThreadLayout } from "../layout/ThreadLayoutProvider";
import { trapTabKey } from "./focus-trap";
import { WorkPanelHeader } from "./WorkPanelHeader";
import { InlineWorkPanelFrame, WorkPanelModal } from "./WorkPanelInline";

interface PanelContext {
  activeId: string | null;
  activeResourceId: string | null;
  /** The narrow inline card's collapsed state; the layout owns it so every frame and entry path agrees. */
  activeCollapsed: boolean;
  setActiveCollapsed(collapsed: boolean): void;
  open(id: string, resourceId?: string, opts?: { collapsed?: boolean }): void;
  focus(): void;
  close(): void;
  container: HTMLDivElement | null;
}
const Context = createContext<PanelContext | null>(null);
export const useWorkPanel = () => useContext(Context);
const FooterContext = createContext<HTMLDivElement | null>(null);
const TitleContext = createContext<string | null>(null);
/** The rendered document title, so embedded content can avoid repeating it safely. */
export const useWorkPanelTitle = () => useContext(TitleContext);

interface FrameRegistry {
  /** The frame (side section, inline card, or modal) of the active panel. */
  setActiveFrame(element: HTMLElement | null): void;
  /** Chat host root the open-full modal makes inert while it is up. */
  layoutRoot: HTMLElement | null;
}
const FrameRegistryContext = createContext<FrameRegistry>({
  setActiveFrame: () => {},
  layoutRoot: null,
});

/** Domain actions stay with their state owner, but remain visible while scrolling. */
export function WorkPanelActions({ children }: { children: ReactNode }) {
  const container = useContext(FooterContext);
  return container ? createPortal(children, container) : <>{children}</>;
}

/** A stable conversation column and a resizable result column; no transcript remount. */
export function WorkPanelLayout({ children }: { children: ReactNode }) {
  const { tier, hostWidth } = useThreadLayout();
  const [active, setActive] = useState<{
    id: string;
    resourceId?: string;
    collapsed?: boolean;
  } | null>(null);
  const activeId = active?.id ?? null;
  const activeResourceId = active?.resourceId ?? null;
  const activeCollapsed = active?.collapsed ?? false;
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(520);
  const returnFocus = useRef<HTMLElement | null>(null);
  const activeFrame = useRef<HTMLElement | null>(null);
  const [layoutRoot, setLayoutRoot] = useState<HTMLDivElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const open = useCallback(
    (id: string, resourceId?: string, opts?: { collapsed?: boolean }) => {
      // Only a genuinely new panel takes over the return-focus target:
      // re-opening the active panel (an in-panel pick) would capture a
      // transient element — or <body> — and strand focus on close.
      if (activeRef.current?.id !== id) {
        returnFocus.current = document.activeElement as HTMLElement;
      }
      setActive((previous) =>
        previous?.id === id
          ? // Re-opening the active panel is user intent: expand it. A
            // programmatic re-open ({ collapsed: true }) leaves it alone.
            {
              id,
              resourceId: resourceId ?? previous.resourceId,
              collapsed: opts?.collapsed === true ? previous.collapsed : false,
            }
          : { id, resourceId, collapsed: opts?.collapsed },
      );
    },
    [],
  );
  const close = useCallback(() => {
    setActive(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }, []);
  const focus = useCallback(() => {
    // View intent expands a collapsed narrow card first, so focus never lands
    // on the collapsed card's own Close button.
    setActive((previous) =>
      previous ? { ...previous, collapsed: false } : previous,
    );
    requestAnimationFrame(() => {
      activeFrame.current
        ?.querySelector<HTMLElement>("[data-panel-close]")
        ?.focus();
    });
  }, []);
  const setActiveFrame = useCallback((element: HTMLElement | null) => {
    activeFrame.current = element;
  }, []);
  const setActiveCollapsed = useCallback((collapsed: boolean) => {
    setActive((previous) => (previous ? { ...previous, collapsed } : previous));
  }, []);
  // A wide→narrow flip with a panel open arrives as the collapsed summary
  // card; the next View/Open expands it again. Only a MEASURED wide counts —
  // the unmeasured default (hostWidth 0) flipping to a narrow first
  // measurement is not a flip and must not collapse a just-opened panel.
  // Zero-width reports (host temporarily hidden) keep the last measurement.
  const prevLayout = useRef({ tier, hostWidth });
  useLayoutEffect(() => {
    const measuredWide =
      prevLayout.current.tier === "wide" && prevLayout.current.hostWidth > 0;
    if (measuredWide && tier === "narrow") {
      setActiveCollapsed(true);
    }
    if (hostWidth > 0) {
      prevLayout.current = { tier, hostWidth };
    }
  }, [tier, hostWidth, setActiveCollapsed]);
  const registry = useMemo(
    () => ({ setActiveFrame, layoutRoot }),
    [setActiveFrame, layoutRoot],
  );
  const value = useMemo(
    () => ({
      activeId,
      activeResourceId,
      activeCollapsed,
      setActiveCollapsed,
      open,
      close,
      focus,
      container,
    }),
    [
      activeId,
      activeResourceId,
      activeCollapsed,
      setActiveCollapsed,
      open,
      close,
      focus,
      container,
    ],
  );
  return (
    <Context.Provider value={value}>
      <FrameRegistryContext.Provider value={registry}>
        <div className="interaction-layout" ref={setLayoutRoot}>
          <div className="interaction-conversation">{children}</div>
          <aside
            className="interaction-workspace"
            style={{ width }}
            hidden={!activeId || tier === "narrow"}
            aria-label="Result panel"
          >
            <div
              role="separator"
              aria-label="Resize result panel"
              aria-orientation="vertical"
              aria-valuenow={width}
              aria-valuemin={360}
              aria-valuemax={800}
              tabIndex={0}
              className="interaction-resizer"
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                  event.preventDefault();
                  setWidth((w) =>
                    Math.max(
                      360,
                      Math.min(800, w + (event.key === "ArrowLeft" ? 32 : -32)),
                    ),
                  );
                }
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  const right =
                    event.currentTarget.parentElement!.getBoundingClientRect()
                      .right;
                  setWidth(Math.max(360, Math.min(800, right - event.clientX)));
                }
              }}
            />
            <div ref={setContainer} className="interaction-panel-slot" />
          </aside>
        </div>
      </FrameRegistryContext.Provider>
    </Context.Provider>
  );
}

/**
 * Portals preserve the caller's providers, including interaction/auth state.
 * In the narrow tier the panel renders inline at its own mount position; the
 * content lives in a stable host element that moves between frames, so a tier
 * flip or the open-full modal never remounts it.
 */
export function WorkPanel({
  id,
  title,
  inlineSummary,
  children,
  onClose,
  footer,
  contentRef,
  onContentScroll,
  label = "Result",
  icon,
  keepMounted = false,
}: {
  id: string;
  title: string;
  /** Collapsed-card title in the narrow tier; defaults to `title`. */
  inlineSummary?: string;
  children: ReactNode;
  onClose?: () => void;
  /** Persistent actions outside the scrolling result body. */
  footer?: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
  onContentScroll?: UIEventHandler<HTMLDivElement>;
  label?: string;
  /** Resource identity shared by side, inline and full-screen toolbars. */
  icon?: ReactNode;
  /** Retain an editor's local draft after its first open, scoped to this work item. */
  keepMounted?: boolean;
}) {
  const panel = useWorkPanel();
  const { tier } = useThreadLayout();
  const { setActiveFrame, layoutRoot } = useContext(FrameRegistryContext);
  const visible = panel?.activeId === id;
  const [opened, setOpened] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);
  const [footerContainer, setFooterContainer] = useState<HTMLDivElement | null>(
    null,
  );
  // One stable host for the content portal, created once per work item; frames
  // physically adopt it, so swapping frames never remounts the content.
  const [contentEl] = useState<HTMLDivElement | null>(() =>
    typeof document === "undefined"
      ? null
      : Object.assign(document.createElement("div"), {
          className: "interaction-panel-body",
        }),
  );
  const mounted = visible || (keepMounted && opened);
  // The scrolling slot must die whole on close: sibling commit order unmounts
  // the content portal before the frame, and emptying the adopted host
  // collapses the slot's overflow, clamping its scrollTop before consumers
  // read it in their ref detach. Defer the content unmount by one commit on
  // the close path only; the open path still commits content before the frame
  // so ref-attach restores into a populated slot.
  const [contentMounted, setContentMounted] = useState(mounted);
  if (mounted && !contentMounted) setContentMounted(true);
  useEffect(() => {
    if (!mounted && contentMounted) setContentMounted(false);
  }, [mounted, contentMounted]);
  useEffect(() => {
    if (visible) setOpened(true);
  }, [visible]);
  // The layout owns the collapsed flag, so the expanded state is derived in
  // the same commit that opens/expands the panel — no post-paint flash.
  const expanded = !panel?.activeCollapsed;
  useEffect(() => {
    if (!visible) setFullOpen(false);
  }, [visible]);
  const wasVisible = useRef(false);
  useEffect(() => {
    if (wasVisible.current && !visible) onClose?.();
    wasVisible.current = visible;
  }, [visible, onClose]);
  const close = () => {
    onClose?.();
    panel?.close();
  };
  // Focus the close button when the panel opens; frame swaps after that (tier
  // flip, open full) must not steal focus from the content.
  const focusOnOpen = useRef(false);
  useEffect(() => {
    if (!visible) {
      focusOnOpen.current = false;
      return;
    }
    if (focusOnOpen.current || !frameEl) return;
    focusOnOpen.current = true;
    frameEl.querySelector<HTMLElement>("[data-panel-close]")?.focus();
  }, [visible, frameEl]);
  useEffect(() => {
    if (!visible || !frameEl) return;
    setActiveFrame(frameEl);
    return () => setActiveFrame(null);
  }, [visible, frameEl, setActiveFrame]);
  // A removed result or changed thread must not leave an empty pane open.
  const panelRef = useRef(panel);
  panelRef.current = panel;
  useEffect(
    () => () => {
      if (panelRef.current?.activeId === id) panelRef.current.close();
    },
    [id],
  );
  const hostContent = useCallback(
    (slot: HTMLDivElement | null) => {
      if (slot && contentEl && contentEl.parentNode !== slot) {
        slot.appendChild(contentEl);
      }
      if (typeof contentRef === "function") contentRef(slot);
      else if (contentRef) contentRef.current = slot;
    },
    [contentEl, contentRef],
  );
  if (!panel) return null;
  const narrow = tier === "narrow";
  // The content portal is a sibling of the frames, so frame onKeyDown handlers
  // only see content events when the frame's own portal container re-targets
  // them (wide/modal). This wrapper is a React ancestor of the content — and of
  // WorkPanelActions portaled into the footer — so Escape/Tab from panel
  // content reach the panel in every placement, including the inline frame.
  const onContentKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as Node;
    // A domain control may own a portaled menu/dialog and its own focus trap.
    if (!contentEl?.contains(target) && !footerContainer?.contains(target)) {
      return;
    }
    if (event.key === "Escape") {
      // Two-level dismissal: the modal exits to the inline frame first.
      // `narrow && fullOpen` is the true "modal is up" condition — a tier flip
      // to wide unmounts the modal without resetting `fullOpen`.
      event.stopPropagation();
      if (narrow && fullOpen) setFullOpen(false);
      else close();
      return;
    }
    // Only the modal constrains Tab; the conversation stays interactive
    // behind the side panel and the inline frame.
    if (event.key === "Tab" && narrow && fullOpen && frameEl) {
      event.stopPropagation();
      trapTabKey(frameEl, event);
    }
  };
  return (
    <>
      {contentMounted && contentEl
        ? createPortal(
            <FooterContext.Provider value={footerContainer}>
              <TitleContext.Provider value={title}>
                <div style={{ display: "contents" }} onKeyDown={onContentKeyDown}>
                  {children}
                </div>
              </TitleContext.Provider>
            </FooterContext.Provider>,
            contentEl,
          )
        : null}
      {visible && !narrow && panel.container
        ? createPortal(
            <section
              ref={setFrameEl}
              className="interaction-panel"
              aria-label={title}
              onKeyDown={(event) => {
                // A domain control may own a portaled menu/dialog and its own focus trap.
                if (!event.currentTarget.contains(event.target as Node)) return;
                if (event.key === "Escape") {
                  event.stopPropagation();
                  close();
                }
              }}
            >
              <WorkPanelHeader title={title} label={label} icon={icon}>
                <button
                  data-panel-close
                  type="button"
                  onClick={close}
                  aria-label="Close result panel"
                >
                  <X size={18} />
                </button>
              </WorkPanelHeader>
              <div
                className="interaction-panel-content"
                ref={hostContent}
                onScroll={onContentScroll}
              />
              <div
                className="interaction-panel-footer"
                ref={setFooterContainer}
              >
                {footer}
              </div>
            </section>,
            panel.container,
          )
        : null}
      {visible && narrow && !fullOpen ? (
        <InlineWorkPanelFrame
          ref={setFrameEl}
          title={title}
          summary={inlineSummary ?? title}
          label={label}
          icon={icon}
          expanded={expanded}
          onExpand={() => panel?.setActiveCollapsed(false)}
          onCollapse={() => panel?.setActiveCollapsed(true)}
          onOpenFull={() => setFullOpen(true)}
          onClose={close}
          contentSlotRef={hostContent}
          onContentScroll={onContentScroll}
          footerRef={setFooterContainer}
          footer={footer}
        />
      ) : null}
      {visible && narrow && fullOpen ? (
        <WorkPanelModal
          ref={setFrameEl}
          title={title}
          label={label}
          icon={icon}
          onClose={close}
          onExitFull={() => setFullOpen(false)}
          contentSlotRef={hostContent}
          onContentScroll={onContentScroll}
          footerRef={setFooterContainer}
          footer={footer}
          inertRoot={layoutRoot}
        />
      ) : null}
    </>
  );
}
