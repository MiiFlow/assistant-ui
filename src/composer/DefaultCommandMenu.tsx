import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { CommandTokenView } from "./CommandTokenView";
import type { ChatComposerCommand } from "./types";

/** The visible toolbar and keyboard triggers share one themed, bounded picker. */
export function DefaultCommandMenu({
  anchorElement,
  editorElement,
  options,
  selectedIndex,
  setHighlightedIndex,
  onSelect,
  queryString,
  trigger,
  loading,
  error,
}: {
  anchorElement: HTMLElement | null;
  editorElement: HTMLElement | null;
  options: ChatComposerCommand[];
  selectedIndex: number;
  setHighlightedIndex: (index: number) => void;
  onSelect: (index: number) => void;
  queryString: string | null;
  trigger: string;
  loading: boolean;
  error?: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const title =
    trigger === "@" ? "Accounts and data tables" : "Skills and guidelines";

  useLayoutEffect(() => {
    if (!anchorElement || !editorElement) return;
    const reposition = () => {
      anchorElement.setAttribute("aria-label", title);
      anchorElement.setAttribute("aria-busy", String(loading));
      const menu = menuRef.current;
      if (!menu) return;
      const anchor = anchorElement.getBoundingClientRect();
      const editor = editorElement.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? innerWidth;
      const height = viewport?.height ?? innerHeight;
      const below = Math.max(0, top + height - anchor.top - 14);
      const above = Math.max(0, anchor.top - anchor.height - top - 14);
      const flip = below < Math.min(menu.scrollHeight, 280) && above > below;
      const maxHeight = Math.max(40, Math.min(280, flip ? above : below));
      const menuWidth = Math.min(440, width - 16);
      const theme = getComputedStyle(editorElement);
      setStyle({
        position: "fixed",
        width: menuWidth,
        left: Math.max(
          left + 8,
          Math.min(editor.left - 8, left + width - menuWidth - 8),
        ),
        top: flip
          ? Math.max(
              top + 8,
              anchor.top -
                anchor.height -
                6 -
                Math.min(menu.scrollHeight, maxHeight),
            )
          : anchor.top + 6,
        maxHeight,
        color: theme.getPropertyValue("--chat-text").trim() || theme.color,
        background: theme.getPropertyValue("--chat-surface").trim() || "#fff",
        borderColor:
          theme.getPropertyValue("--chat-border").trim() || "#dbd9d3",
        fontFamily: theme.fontFamily,
        "--chat-focus":
          theme.getPropertyValue("--chat-focus").trim() || "#b94317",
      } as CSSProperties);
    };
    reposition();
    // Lexical updates its caret anchor during the same commit.
    const frame = requestAnimationFrame(reposition);
    const observer = new ResizeObserver(reposition);
    observer.observe(editorElement);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [
    anchorElement,
    editorElement,
    options.length,
    queryString,
    loading,
    error,
    title,
  ]);

  useEffect(() => {
    const menu = menuRef.current;
    const selected = menu?.querySelector<HTMLElement>(
      `#typeahead-item-${selectedIndex}`,
    );
    if (!menu || !selected) return;
    const outer = menu.getBoundingClientRect();
    const inner = selected.getBoundingClientRect();
    if (inner.top < outer.top) menu.scrollTop -= outer.top - inner.top;
    else if (inner.bottom > outer.bottom)
      menu.scrollTop += inner.bottom - outer.bottom;
  }, [selectedIndex, options.length]);

  if (!anchorElement) return null;
  return createPortal(
    <div ref={menuRef} className="chat-command-menu" style={style}>
      <div className="chat-command-menu-heading">
        <strong>{title}</strong>
        <span>Type to search · Esc to close</span>
      </div>
      {loading && <p role="status">Loading options…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && options.length === 0 && (
        <p role="status">
          {queryString
            ? `No matches for “${queryString}”. Try another search.`
            : trigger === "@"
              ? "No connected accounts or data tables are available."
              : "No skills available. Type a guideline name to search."}
        </p>
      )}
      <div>
        {options.map((command, index) => (
          <CommandTokenView
            key={`${command.kind}:${command.id}`}
            variant="row"
            {...command}
            selected={index === selectedIndex}
            htmlId={`typeahead-item-${index}`}
            onMouseEnter={() => setHighlightedIndex(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setHighlightedIndex(index);
              onSelect(index);
            }}
          />
        ))}
      </div>
    </div>,
    anchorElement,
  );
}
