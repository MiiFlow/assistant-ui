import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type UIEventHandler,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface PanelContext {
  activeId: string | null;
  activeResourceId: string | null;
  open(id: string, resourceId?: string): void;
  focus(): void;
  close(): void;
  container: HTMLDivElement | null;
}
const Context = createContext<PanelContext | null>(null);
export const useWorkPanel = () => useContext(Context);
const FooterContext = createContext<HTMLDivElement | null>(null);

/** Domain actions stay with their state owner, but remain visible while scrolling. */
export function WorkPanelActions({ children }: { children: ReactNode }) {
  const container = useContext(FooterContext);
  return container ? createPortal(children, container) : <>{children}</>;
}

/** A stable conversation column and a resizable result column; no transcript remount. */
export function WorkPanelLayout({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<{
    id: string;
    resourceId?: string;
  } | null>(null);
  const activeId = active?.id ?? null;
  const activeResourceId = active?.resourceId ?? null;
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(520);
  const returnFocus = useRef<HTMLElement | null>(null);
  const main = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = matchMedia("(max-width: 899.95px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const open = useCallback((id: string, resourceId?: string) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setActive({ id, resourceId });
  }, []);
  const close = useCallback(() => {
    setActive(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }, []);
  const focus = useCallback(() => {
    container
      ?.querySelector<HTMLElement>(
        ".interaction-panel:not([hidden]) [data-panel-close]",
      )
      ?.focus();
  }, [container]);
  const value = useMemo(
    () => ({ activeId, activeResourceId, open, close, focus, container }),
    [activeId, activeResourceId, open, close, focus, container],
  );
  useEffect(() => {
    if (main.current) main.current.inert = mobile && !!activeId;
  }, [mobile, activeId]);
  return (
    <Context.Provider value={value}>
      <div className="interaction-layout">
        <div className="interaction-conversation" ref={main}>
          {children}
        </div>
        <aside
          className="interaction-workspace"
          style={{ width }}
          hidden={!activeId}
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
    </Context.Provider>
  );
}

/** Portals preserve the caller's providers, including interaction/auth state. */
export function WorkPanel({
  id,
  title,
  children,
  onClose,
  footer,
  contentRef,
  onContentScroll,
  label = "Result",
  keepMounted = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  /** Persistent actions outside the scrolling result body. */
  footer?: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
  onContentScroll?: UIEventHandler<HTMLDivElement>;
  label?: string;
  /** Retain an editor's local draft after its first open, scoped to this work item. */
  keepMounted?: boolean;
}) {
  const panel = useWorkPanel();
  const closeButton = useRef<HTMLButtonElement>(null);
  const visible = panel?.activeId === id;
  const [opened, setOpened] = useState(false);
  const [footerContainer, setFooterContainer] = useState<HTMLDivElement | null>(
    null,
  );
  useEffect(() => {
    if (visible) setOpened(true);
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
  useEffect(() => {
    if (visible) closeButton.current?.focus();
  }, [visible, panel?.container]);
  // A removed result or changed thread must not leave an empty pane open.
  const panelRef = useRef(panel);
  panelRef.current = panel;
  useEffect(
    () => () => {
      if (panelRef.current?.activeId === id) panelRef.current.close();
    },
    [id],
  );
  if ((!visible && !(keepMounted && opened)) || !panel?.container) return null;
  return createPortal(
    <FooterContext.Provider value={footerContainer}>
      <section
        className="interaction-panel"
        aria-label={title}
        hidden={!visible}
        inert={!visible}
        onKeyDown={(event) => {
          // A domain control may own a portaled menu/dialog and its own focus trap.
          if (!event.currentTarget.contains(event.target as Node)) return;
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          }
          if (
            event.key === "Tab" &&
            matchMedia("(max-width: 899.95px)").matches
          ) {
            const focusable = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), iframe, [tabindex="0"]',
              ),
            ].filter(
              (element) =>
                element.getClientRects().length > 0 &&
                !element.closest("[inert]"),
            );
            const first = focusable[0],
              last = focusable[focusable.length - 1];
            const active = document.activeElement;
            // Removal can focus a status with tabindex=-1. Include that position
            // when deciding whether Tab would cross the panel's boundary.
            const direction = event.shiftKey
              ? Node.DOCUMENT_POSITION_PRECEDING
              : Node.DOCUMENT_POSITION_FOLLOWING;
            if (
              active &&
              !focusable.some((element) =>
                Boolean(active.compareDocumentPosition(element) & direction),
              )
            ) {
              event.preventDefault();
              (event.shiftKey ? last : first)?.focus();
            }
          }
        }}
      >
        <header className="interaction-panel-header">
          <div>
            <span>{label}</span>
            <h2>{title}</h2>
          </div>
          <button
            ref={closeButton}
            data-panel-close
            type="button"
            onClick={close}
            aria-label="Close result panel"
          >
            <X size={18} />
          </button>
        </header>
        <div
          className="interaction-panel-content"
          ref={contentRef}
          onScroll={onContentScroll}
        >
          {children}
        </div>
        <div className="interaction-panel-footer" ref={setFooterContainer}>
          {footer}
        </div>
      </section>
    </FooterContext.Provider>,
    panel.container,
  );
}
