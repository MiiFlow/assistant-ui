import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type Ref,
  type SetStateAction,
} from "react";
import { ArrowUpRight, Check, MapPin } from "lucide-react";
import {
  interactionSchema,
  useInteraction,
  type InteractionSurface,
  type InteractionItem,
} from "./runtime";
import { useWorkPanel, WorkPanel } from "./WorkPanel";
import { WorkItemHeader } from "./WorkItemHeader";
import {
  InteractionError,
  InteractionSelectionBar,
} from "./InteractionSelectionBar";

type BrowseState = {
  query: string;
  page: number;
  mapEnabled: boolean;
  images: Record<string, "loaded" | "failed">;
};

/** One native renderer for all hosts; transport and organization auth are host dependencies. */
export function InteractionVisualization({ data }: { data: unknown }) {
  const parsed = useMemo(() => interactionSchema.safeParse(data), [data]);
  if (!parsed.success)
    return (
      <div role="status">
        This interactive result cannot be displayed. Ask the assistant to
        recreate it.
      </div>
    );
  return (
    <Surface
      key={`${parsed.data.threadId}:${parsed.data.id}`}
      initial={parsed.data}
    />
  );
}
function Surface({ initial }: { initial: InteractionSurface }) {
  const entry = useInteraction(initial);
  const { surface, runtime } = entry;
  const panel = useWorkPanel();
  const instanceId = useId();
  const panelId = `${surface.id}:${instanceId}`;
  const resourceId = `interaction:${surface.threadId}:${surface.id}`;
  const expanded = panel?.activeResourceId === resourceId;
  // Presentation changes must not reset browsing or explicit media consent.
  const [view, setView] = useState<BrowseState>({
    query: "",
    page: 0,
    mapEnabled: false,
    images: {},
  });
  const scrollTop = useRef(0);
  const scrollElement = useRef<HTMLDivElement | null>(null);
  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (scrollElement.current)
      scrollTop.current = scrollElement.current.scrollTop;
    scrollElement.current = node;
    if (node) node.scrollTop = scrollTop.current;
  }, []);
  const resetScroll = () => {
    scrollTop.current = 0;
    if (scrollElement.current) scrollElement.current.scrollTop = 0;
  };
  const comparison = useRef<HTMLDivElement>(null);
  const compareTrigger = useRef<Element | null>(null);
  const pendingComparison = useRef(false);
  const compare = () => {
    compareTrigger.current = document.activeElement;
    pendingComparison.current = true;
    void runtime?.act(surface.id, "compare", {});
  };
  useEffect(() => {
    if (!pendingComparison.current || entry.busy) return;
    if (entry.error) {
      if (!entry.retry) pendingComparison.current = false;
      return;
    }
    pendingComparison.current = false;
    if (!surface.state.comparing || !comparison.current) return;
    // Do not interrupt someone who moved back to writing while the save ran.
    if (
      document.activeElement !== compareTrigger.current &&
      document.activeElement !== document.body
    )
      return;
    comparison.current.focus({ preventScroll: true });
    comparison.current.scrollIntoView({ block: "start", behavior: "instant" });
  }, [entry.busy, entry.error, entry.retry, surface.state.comparing]);
  const supported =
    surface.version === 1 &&
    ["product_collection", "link_preview", "place_map"].includes(
      surface.component,
    );
  const products = surface.component === "product_collection";
  const content = (inPanel = false) => (
    <SurfaceContent
      entry={entry}
      expanded={inPanel}
      view={view}
      setView={setView}
      resetScroll={resetScroll}
      comparisonRef={comparison}
    />
  );
  const selection = products ? (
    <InteractionSelectionBar entry={entry} onCompare={compare} />
  ) : null;
  const count = surface.data.items.length;
  const noun = products
    ? "product"
    : surface.component === "place_map"
      ? "place"
      : "source";
  return (
    <section
      data-interaction
      aria-label={surface.title}
      className={expanded ? "interaction-reference" : undefined}
    >
      <WorkItemHeader
        title={surface.title}
        label={products ? "PRODUCT COLLECTION" : surface.component === "place_map" ? "PLACES" : "SOURCES"}
        expanded={expanded}
        summary={expanded ? `${count} ${noun}${count === 1 ? "" : "s"}${surface.state.selectedIds.length ? `, ${surface.state.selectedIds.length} selected` : ""} · Open in result panel` : undefined}
        onOpen={panel && supported && !entry.unavailable
          ? () => expanded ? panel.focus() : panel.open(panelId, resourceId)
          : undefined}
      />
      {!supported ? (
        <p>This result requires a newer version of the app.</p>
      ) : entry.unavailable ? (
        <p role="alert">{entry.error}</p>
      ) : (
        <>
          {!runtime && (
            <p className="interaction-note">
              Preview only. Open this conversation in the workspace to interact.
            </p>
          )}
          {!expanded && (
            <>
              {content()}
              {selection}
            </>
          )}
          <WorkPanel
            id={panelId}
            title={surface.title}
            contentRef={contentRef}
            onContentScroll={(event) => {
              scrollTop.current = event.currentTarget.scrollTop;
            }}
            footer={selection && <div data-interaction>{selection}</div>}
          >
            <div data-interaction>{content(true)}</div>
          </WorkPanel>
        </>
      )}
    </section>
  );
}
function SurfaceContent({
  entry,
  expanded,
  view,
  setView,
  resetScroll,
  comparisonRef,
}: {
  entry: ReturnType<typeof useInteraction>;
  expanded: boolean;
  view: BrowseState;
  setView: Dispatch<SetStateAction<BrowseState>>;
  resetScroll: () => void;
  comparisonRef: Ref<HTMLDivElement>;
}) {
  const { surface, runtime, busy, ready, retry } = entry;
  const { query, page } = view;
  const setPage = (page: number) => {
    setView((current) => ({ ...current, page }));
    resetScroll();
  };
  const { items } = surface.data;
  const selected = surface.state.selectedIds;
  const products = surface.component === "product_collection";
  const places = surface.component === "place_map";
  const disabled = !runtime || !ready || busy || !!retry;
  const filtered = items.filter((item) =>
    `${item.title} ${item.description ?? ""}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const pageSize = 4;
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  const visible = filtered.slice(
    safePage * pageSize,
    (safePage + 1) * pageSize,
  );
  const toggle = (id: string) =>
    void runtime?.act(surface.id, "select", {
      ids: places
        ? [id]
        : selected.includes(id)
          ? selected.filter((value) => value !== id)
          : [...selected, id],
    });
  return (
    <>
      {!products && <InteractionError entry={entry} />}
      {items.length > 4 && (
        <label className="interaction-search">
          <span className="sr-only">
            Search {places ? "places" : "results"}
          </span>
          <input
            type="search"
            placeholder={places ? "Find a place…" : "Filter these results…"}
            value={query}
            onChange={(e) => {
              const query = e.target.value;
              setView((current) => ({ ...current, query, page: 0 }));
              resetScroll();
            }}
          />
        </label>
      )}
      {places && (
        <PlaceMap
          item={items.find((item) => item.id === selected[0]) ?? items[0]}
          expanded={expanded}
          enabled={view.mapEnabled}
          onEnable={() =>
            setView((current) => ({ ...current, mapEnabled: true }))
          }
        />
      )}
      {surface.state.comparing && products ? (
        <Comparison
          comparisonRef={comparisonRef}
          items={items.filter((item) => selected.includes(item.id))}
        />
      ) : null}
      <div className={products ? "interaction-products" : "interaction-links"}>
        {visible.map((item) => (
          <article
            key={item.id}
            className={`interaction-item ${selected.includes(item.id) ? "is-selected" : ""}`}
          >
            {products && item.image_url && (
              <ProductImage
                item={item}
                state={view.images[item.image_url]}
                onState={(state) =>
                  setView((current) => ({
                    ...current,
                    images: { ...current.images, [item.image_url!]: state },
                  }))
                }
              />
            )}
            <div className="interaction-item-body">
              <h4>{item.title}</h4>
              {item.price && <p className="interaction-price">{item.price}</p>}
              {item.description && (
                <p className="interaction-description">{item.description}</p>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  {new URL(item.url).hostname.replace(/^www\./, "")}{" "}
                  <ArrowUpRight size={14} />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {(products || places) && (
                <button
                  type="button"
                  aria-label={
                    places
                      ? `Show ${item.title} on map`
                      : selected.includes(item.id)
                        ? `Selected ${item.title}`
                        : `Select ${item.title}`
                  }
                  aria-pressed={selected.includes(item.id)}
                  disabled={
                    disabled ||
                    (products &&
                      selected.length >= surface.selectionLimit &&
                      !selected.includes(item.id))
                  }
                  onClick={() => toggle(item.id)}
                >
                  {selected.includes(item.id) ? (
                    <Check size={15} />
                  ) : places ? (
                    <MapPin size={15} />
                  ) : null}
                  {places
                    ? "Show on map"
                    : selected.includes(item.id)
                      ? "Selected"
                      : "Select"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p className="interaction-note">No results match “{query}”.</p>
      )}
      {filtered.length > pageSize && (
        <nav className="interaction-pagination" aria-label="Result pages">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </button>
          <span>
            {safePage + 1} / {Math.ceil(filtered.length / pageSize)}
          </span>
          <button
            type="button"
            disabled={(safePage + 1) * pageSize >= filtered.length}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </button>
        </nav>
      )}
      {places && (
        <footer className="interaction-footer">
          <span role="status" aria-live="polite">
            {busy
              ? "Saving…"
              : !ready && runtime
                ? "Connecting…"
                : ready
                  ? "Selection saved to this conversation"
                  : "Preview"}
          </span>
        </footer>
      )}
    </>
  );
}
function Comparison({
  items,
  comparisonRef,
}: {
  items: InteractionItem[];
  comparisonRef: Ref<HTMLDivElement>;
}) {
  const attributes = [
    ...new Set(items.flatMap((item) => Object.keys(item.details ?? {}))),
  ];
  return (
    <div
      className="interaction-comparison"
      ref={comparisonRef}
      tabIndex={0}
      role="region"
      aria-label="Product comparison"
    >
      <table>
        <caption>Side by side</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            {items.map((item) => (
              <th scope="col" key={item.id}>
                {item.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {["Price", ...attributes.filter((a) => a !== "Price")].map(
            (attribute) => (
              <tr key={attribute}>
                <th scope="row">{attribute}</th>
                {items.map((item) => (
                  <td key={item.id}>
                    {attribute === "Price"
                      ? (item.price ?? "Not provided")
                      : (item.details?.[attribute] ?? "Not provided")}
                  </td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
function PlaceMap({
  item,
  expanded,
  enabled,
  onEnable,
}: {
  item: InteractionItem;
  expanded: boolean;
  enabled: boolean;
  onEnable: () => void;
}) {
  if (item.latitude === undefined || item.longitude === undefined)
    return <p>Map coordinates are unavailable.</p>;
  const lat = item.latitude,
    lon = item.longitude;
  const bounds = [
    Math.max(-180, lon - 0.025),
    Math.max(-85, lat - 0.015),
    Math.min(180, lon + 0.025),
    Math.min(85, lat + 0.015),
  ].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${lat}%2C${lon}`;
  return (
    <div className="interaction-map">
      {enabled ? (
        <iframe
          key={item.id}
          title={`Interactive map: ${item.title}`}
          src={src}
          style={{ height: expanded ? 400 : 260 }}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      ) : (
        <div className="interaction-map-placeholder">
          <MapPin size={24} />
          <strong>{item.title}</strong>
          <span>
            {lat.toFixed(4)}, {lon.toFixed(4)}
          </span>
          <button type="button" onClick={onEnable}>
            Load interactive map
          </button>
        </div>
      )}
      <small>
        Map by{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap
        </a>
        . Loading connects to its map service.
      </small>
    </div>
  );
}

function ProductImage({
  item,
  state,
  onState,
}: {
  item: InteractionItem;
  state?: "loaded" | "failed";
  onState: (state: "loaded" | "failed") => void;
}) {
  if (state === "failed")
    return <p className="interaction-note">Image unavailable.</p>;
  if (state !== "loaded")
    return (
      <button
        type="button"
        className="interaction-image-placeholder"
        onClick={() => onState("loaded")}
      >
        Load image for {item.title}
      </button>
    );
  return (
    <img
      src={item.image_url}
      alt={item.title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => onState("failed")}
    />
  );
}
