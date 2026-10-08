import { useId, useMemo, useState } from "react";
import { ArrowUpRight, Check, Columns2, Expand, MapPin } from "lucide-react";
import {
  interactionSchema,
  useInteraction,
  type InteractionSurface,
  type InteractionItem,
} from "./runtime";
import { useWorkPanel, WorkPanel } from "./WorkPanel";

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
  return <Surface initial={parsed.data} />;
}
function Surface({ initial }: { initial: InteractionSurface }) {
  const entry = useInteraction(initial);
  const { surface, runtime } = entry;
  const panel = useWorkPanel();
  const instanceId = useId();
  const panelId = `${surface.id}:${instanceId}`;
  const supported =
    surface.version === 1 &&
    ["product_collection", "link_preview", "place_map"].includes(
      surface.component,
    );
  const content = (expanded = false) => (
    <SurfaceContent entry={entry} expanded={expanded} />
  );
  return (
    <section data-interaction aria-label={surface.title}>
      <header className="interaction-heading">
        <div>
          <span className="interaction-eyebrow">
            {surface.component === "product_collection"
              ? "PRODUCT COLLECTION"
              : surface.component === "place_map"
                ? "PLACES"
                : "SOURCES"}
          </span>
          <h3>{surface.title}</h3>
        </div>
        {panel && supported && !entry.unavailable && (
          <button
            className="interaction-icon"
            type="button"
            aria-label={`Expand ${surface.title}`}
            onClick={() => panel.open(panelId)}
          >
            <Expand size={17} />
          </button>
        )}
      </header>
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
          {content()}
          <WorkPanel id={panelId} title={surface.title}>
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
}: {
  entry: ReturnType<typeof useInteraction>;
  expanded: boolean;
}) {
  const { surface, runtime, busy, ready, error, retry } = entry;
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
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
  const pageSize = expanded ? 12 : 4;
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
      {error && (
        <div className="interaction-error" role="alert">
          {error}{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => void runtime?.retry(surface.id)}
          >
            {retry ? "Retry saving" : "Refresh result"}
          </button>
        </div>
      )}
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
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
      )}
      {places && (
        <PlaceMap
          item={items.find((item) => item.id === selected[0]) ?? items[0]}
          expanded={expanded}
        />
      )}
      {surface.state.comparing && products ? (
        <Comparison
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
              <ProductImage item={item} />
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
      {(products || places) && (
        <footer className="interaction-footer">
          <span role="status" aria-live="polite">
            {busy
              ? "Saving…"
              : !ready && runtime
                ? "Connecting…"
                : products
                  ? `${selected.length} of ${surface.selectionLimit} selected${ready ? " · Saved to this conversation" : ""}`
                  : ready
                    ? "Selection saved to this conversation"
                    : "Preview"}
          </span>
          {products && (
            <button
              className="interaction-primary"
              type="button"
              disabled={disabled || selected.length < 2}
              onClick={() => void runtime?.act(surface.id, "compare", {})}
            >
              <Columns2 size={15} /> Compare selected
            </button>
          )}
        </footer>
      )}
    </>
  );
}
function Comparison({ items }: { items: InteractionItem[] }) {
  const attributes = [
    ...new Set(items.flatMap((item) => Object.keys(item.details ?? {}))),
  ];
  return (
    <div
      className="interaction-comparison"
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
}: {
  item: InteractionItem;
  expanded: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
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
          <button type="button" onClick={() => setEnabled(true)}>
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


function ProductImage({ item }: { item: InteractionItem }) {
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const [failedUrl, setFailedUrl] = useState<string>();
  if (failedUrl === item.image_url)
    return <p className="interaction-note">Image unavailable.</p>;
  if (loadedUrl !== item.image_url)
    return (
      <button type="button" className="interaction-image-placeholder"
        onClick={() => setLoadedUrl(item.image_url)}>
        Load image for {item.title}
      </button>
    );
  return <img src={item.image_url} alt={item.title} loading="lazy"
    referrerPolicy="no-referrer" onError={() => setFailedUrl(item.image_url)} />;
}
