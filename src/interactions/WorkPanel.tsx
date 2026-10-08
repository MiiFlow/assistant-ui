import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface PanelContext {
  activeId: string | null;
  open(id: string): void;
  close(): void;
  container: HTMLDivElement | null;
}
const Context = createContext<PanelContext | null>(null);
export const useWorkPanel = () => useContext(Context);

/** A stable conversation column and a resizable result column; no transcript remount. */
export function WorkPanelLayout({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
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
  const open = useCallback((id: string) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setActiveId(id);
  }, []);
  const close = useCallback(() => {
    setActiveId(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }, []);
  const value = useMemo(
    () => ({ activeId, open, close, container }),
    [activeId, open, close, container],
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
}: {
  id: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const panel = useWorkPanel();
  const closeButton = useRef<HTMLButtonElement>(null);
  const visible = panel?.activeId === id;
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
  if (!visible || !panel?.container) return null;
  return createPortal(
    <section
      className="interaction-panel"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
        if (event.key === "Tab" && matchMedia("(max-width: 899.95px)").matches) {
          const focusable = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], input:not(:disabled), select, iframe, [tabindex="0"]',
            ),
          ];
          const first = focusable[0],
            last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
          if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header className="interaction-panel-header">
        <div>
          <span>WORKSPACE</span>
          <h2>{title}</h2>
        </div>
        <button
          ref={closeButton}
          type="button"
          onClick={close}
          aria-label="Close result panel"
        >
          <X size={18} />
        </button>
      </header>
      <div className="interaction-panel-content">{children}</div>
    </section>,
    panel.container,
  );
}
