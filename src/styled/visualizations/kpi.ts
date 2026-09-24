/**
 * Rendering semantics for KPI visualizations, shared by every renderer (this
 * package's Tailwind one and the web app's MUI one) so they can't disagree
 * about what a payload means.
 *
 * The model states facts about a metric — the signed `change`, whether higher
 * is better — and this module does the arithmetic. Before `polarity` existed
 * the model had to compute good/bad itself and encode it in `trend`, which the
 * renderers read as direction: a rising CPA sent as trend "down" showed a red
 * down-arrow beside "+5.0%".
 */
import type { KpiMetric } from "../../types";

export type KpiDirection = -1 | 0 | 1;
export type KpiTone = "good" | "bad" | "warning" | "neutral";
export type KpiHeroVisual = "breakdown" | "sparkline" | "meter" | null;

const POLARITIES: ReadonlySet<string> = new Set(["higher_is_better", "lower_is_better", "neutral"]);
const STATUSES: ReadonlySet<string> = new Set(["good", "warning", "bad"]);

/**
 * The metric's polarity, or null for a value this renderer doesn't know. The
 * schema accepts any string here so an off-enum value from a non-strict tool
 * call degrades to "no polarity" instead of failing the whole block.
 */
export function metricPolarity(metric: KpiMetric): KpiMetric["polarity"] | null {
  return metric.polarity && POLARITIES.has(metric.polarity) ? metric.polarity : null;
}

/** The metric's status, or null for a value this renderer doesn't know. */
export function metricStatus(metric: KpiMetric): NonNullable<KpiMetric["status"]> | null {
  return metric.status && STATUSES.has(metric.status) ? metric.status : null;
}

/** Direction of a change, read from its sign only. Unsigned ("20.7%") is 0. */
export function changeDirection(change: KpiMetric["change"]): KpiDirection {
  if (change === undefined || change === null) return 0;
  if (typeof change === "number") return change > 0 ? 1 : change < 0 ? -1 : 0;
  const s = change.trim();
  if (/^[+\u2191]/.test(s)) return 1;
  if (/^[-\u2212\u2013\u2193]/.test(s)) return -1;
  return 0;
}

/**
 * Arrow direction for the chip: the sign of `change`. A legacy payload whose
 * change is unsigned falls back to its `trend`, which is what it showed before.
 */
export function arrowDirection(metric: KpiMetric): KpiDirection {
  const dir = changeDirection(metric.change);
  if (dir !== 0 || metricPolarity(metric)) return dir;
  return metric.trend === "up" ? 1 : metric.trend === "down" ? -1 : 0;
}

export function hasChange(metric: KpiMetric): boolean {
  return metric.change !== undefined && metric.change !== null && metric.change !== "";
}

/** "+12" for numeric changes; strings are shown as the model wrote them. */
export function formatChange(change: NonNullable<KpiMetric["change"]>): string {
  if (typeof change === "number") return `${change > 0 ? "+" : ""}${change}`;
  return change;
}

/**
 * Color of the change chip: the change's direction combined with the metric's
 * polarity. With no polarity the chip is neutral — a direction with no
 * assertion about which way is good.
 *
 * Legacy payloads (`trend`, no `polarity`) keep trend's old colors, up = good
 * and down = bad. That is also the right reading of the payloads where trend
 * contradicts the sign of change ("Blended CPA", trend "down", "+5.0%"): the
 * model was using trend as sentiment. Only the arrow changes for them — it now
 * follows the sign.
 */
export function resolveKpiTone(metric: KpiMetric): KpiTone {
  const dir = changeDirection(metric.change);
  switch (metricPolarity(metric)) {
    case "higher_is_better":
      return dir > 0 ? "good" : dir < 0 ? "bad" : "neutral";
    case "lower_is_better":
      return dir < 0 ? "good" : dir > 0 ? "bad" : "neutral";
    case "neutral":
      return "neutral";
  }
  if (metric.trend === "up") return "good";
  if (metric.trend === "down") return "bad";
  return "neutral";
}

/**
 * Whether a value reads as a spec rather than a figure ("200A Meter/Main
 * Combo"). Text values get body-size type and no count-up.
 */
export function isTextValue(value: KpiMetric["value"]): boolean {
  if (typeof value === "number") return false;
  return !/^[~≈]?[^\d\s]{0,3}[+\-−]?[\d,]*\.?\d+[^\s\d]{0,3}$/.test(value.trim());
}

export function pickHeroIndex(metrics: KpiMetric[]): number {
  const explicit = metrics.findIndex((m) => m.prominence === "primary");
  return explicit >= 0 ? explicit : 0;
}

/**
 * The richest thing a hero can show beside its value. A hero with none of
 * these is one short row — it never reserves space for a visual it lacks.
 */
export function heroVisual(metric: KpiMetric): KpiHeroVisual {
  if (metric.breakdown && metric.breakdown.length > 0) return "breakdown";
  if (metric.sparkline && metric.sparkline.length > 1) return "sparkline";
  if (metric.meter) return "meter";
  return null;
}

/**
 * Column count for `count` cells that fills rows evenly: the fewest rows that
 * fit within `maxCols`, then the fewest columns that fit in those rows. 5 → 3+2,
 * 7 → 4+3, never 4+1. Renderers let a short last row stretch, so no cell is
 * ever left empty; a narrow container sheds columns via the cell min-width.
 */
export function balancedColumns(count: number, maxCols = 4): number {
  if (count <= 0) return 1;
  const rows = Math.ceil(count / maxCols);
  return Math.ceil(count / rows);
}

/**
 * A 0–1 fraction from what the model sent. Models sometimes send percent scale
 * (20.7 for 20.7%), so a value above 1 and at most 100 is read as a percent.
 */
export function toFraction(n: number | null | undefined): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  const f = n > 1 && n <= 100 ? n / 100 : n;
  return Math.min(1, Math.max(0, f));
}

/** "20.7%" from 0.207 (or 20.7). */
export function formatFraction(n: number | null | undefined): string {
  const pct = toFraction(n) * 100;
  return `${pct.toFixed(1).replace(/\.0$/, "")}%`;
}

/** Breakdown items that can be drawn as bar segments. */
export function drawableBreakdown(metric: KpiMetric): { label: string; share: number }[] {
  return (metric.breakdown ?? [])
    .map((b) => ({ label: b.label, share: toFraction(b.share) }))
    .filter((b) => b.share > 0);
}

export interface SparklineGeometry {
  line: string;
  area: string;
  end: { x: number; y: number };
}

/** SVG paths for a sparkline in a `width`×`height` box, `pad` inset for the end dot. */
export function sparklineGeometry(
  values: number[],
  width: number,
  height: number,
  pad = 3,
): SparklineGeometry | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return null;
  const min = Math.min(...finite);
  const range = Math.max(...finite) - min || 1;
  const pts = finite.map((v, i) => ({
    x: pad + ((width - 2 * pad) * i) / (finite.length - 1),
    y: pad + (height - 2 * pad) * (1 - (v - min) / range),
  }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
  const first = pts[0];
  const end = pts[pts.length - 1];
  const area = `${line}L${end.x.toFixed(1)} ${height}L${first.x.toFixed(1)} ${height}Z`;
  return { line, area, end };
}
