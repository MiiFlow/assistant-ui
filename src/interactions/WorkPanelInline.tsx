import {
  forwardRef,
  useEffect,
  useRef,
  type ReactNode,
  type Ref,
  type UIEventHandler,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, X } from "lucide-react";
import { trapTabKey } from "./focus-trap";

export interface InlineWorkPanelFrameProps {
  title: string;
  /** Collapsed-card title; defaults handled by the caller (`summary = inlineSummary ?? title`). */
  summary: string;
  label: string;
  expanded: boolean;
  onExpand(): void;
  onCollapse(): void;
  onOpenFull(): void;
  onClose(): void;
  /** Slot that physically hosts the panel's stable content element. */
  contentSlotRef: Ref<HTMLDivElement>;
  onContentScroll?: UIEventHandler<HTMLDivElement>;
  footerRef: Ref<HTMLDivElement>;
  footer?: ReactNode;
}

/** Narrow-tier frame: a collapsed card that expands in place at the panel's mount position. */
export const InlineWorkPanelFrame = forwardRef<
  HTMLDivElement,
  InlineWorkPanelFrameProps
>(function InlineWorkPanelFrame(
  {
    title,
    summary,
    label,
    expanded,
    onExpand,
    onCollapse,
    onOpenFull,
    onClose,
    contentSlotRef,
    onContentScroll,
    footerRef,
    footer,
  },
  ref,
) {
  if (!expanded) {
    return (
      <div ref={ref} className="interaction-inline-panel" aria-label={title}>
        <div className="interaction-inline-panel-summary">
          <span className="interaction-inline-panel-title">{summary}</span>
          <button
            type="button"
            className="interaction-icon"
            onClick={onExpand}
            aria-label="Expand panel"
          >
            <ChevronDown size={18} />
          </button>
          <button
            type="button"
            className="interaction-icon"
            data-panel-close
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="interaction-inline-panel is-expanded"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="interaction-panel-header">
        <div>
          <span>{label}</span>
          <h2>{title}</h2>
        </div>
        <div className="interaction-inline-panel-actions">
          <button
            type="button"
            className="interaction-icon"
            onClick={onCollapse}
            aria-label="Collapse panel"
          >
            <ChevronUp size={18} />
          </button>
          <button
            type="button"
            className="interaction-icon"
            onClick={onOpenFull}
            aria-label="Open full"
          >
            <Maximize2 size={18} />
          </button>
          <button
            type="button"
            className="interaction-icon"
            data-panel-close
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <div
        className="interaction-panel-content"
        ref={contentSlotRef}
        onScroll={onContentScroll}
      />
      <div className="interaction-panel-footer" ref={footerRef}>
        {footer}
      </div>
    </div>
  );
});

export interface WorkPanelModalProps {
  title: string;
  label: string;
  /** Close the panel entirely (the sheet's X). */
  onClose(): void;
  /** Leave full screen, back to the expanded inline frame (Escape/backdrop). */
  onExitFull(): void;
  contentSlotRef: Ref<HTMLDivElement>;
  onContentScroll?: UIEventHandler<HTMLDivElement>;
  footerRef: Ref<HTMLDivElement>;
  footer?: ReactNode;
  /** Chat host root; inert while the modal is up. */
  inertRoot: HTMLElement | null;
}

/** Full-screen narrow-tier frame: the same panel content over an inert conversation. */
export const WorkPanelModal = forwardRef<HTMLDivElement, WorkPanelModalProps>(
  function WorkPanelModal(
    {
      title,
      label,
      onClose,
      onExitFull,
      contentSlotRef,
      onContentScroll,
      footerRef,
      footer,
      inertRoot,
    },
    ref,
  ) {
    const sheet = useRef<HTMLDivElement | null>(null);
    const setRefs = (node: HTMLDivElement | null) => {
      sheet.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };
    useEffect(() => {
      sheet.current
        ?.querySelector<HTMLElement>("[data-panel-close]")
        ?.focus();
    }, []);
    useEffect(() => {
      if (!inertRoot) return;
      inertRoot.inert = true;
      return () => {
        inertRoot.inert = false;
      };
    }, [inertRoot]);
    return createPortal(
      <div className="interaction-inline-modal">
        <div
          className="interaction-inline-modal-backdrop"
          onClick={onExitFull}
        />
        <div
          ref={setRefs}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="interaction-inline-modal-sheet"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onExitFull();
              return;
            }
            trapTabKey(event.currentTarget, event);
          }}
        >
          <header className="interaction-panel-header">
            <div>
              <span>{label}</span>
              <h2>{title}</h2>
            </div>
            <div className="interaction-inline-panel-actions">
              <button
                type="button"
                className="interaction-icon"
                onClick={onExitFull}
                aria-label="Back to inline view"
              >
                <Minimize2 size={18} />
              </button>
              <button
                type="button"
                className="interaction-icon"
                data-panel-close
                onClick={onClose}
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </div>
          </header>
          <div
            className="interaction-panel-content"
            ref={contentSlotRef}
            onScroll={onContentScroll}
          />
          <div className="interaction-panel-footer" ref={footerRef}>
            {footer}
          </div>
        </div>
      </div>,
      document.body,
    );
  },
);
