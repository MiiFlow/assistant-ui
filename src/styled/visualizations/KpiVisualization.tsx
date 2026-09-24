import { ArrowDown, ArrowUp, Info, Minus } from "lucide-react";
import { cn } from "../../utils/cn";
import type { KpiVisualizationData, KpiMetric, VisualizationConfig } from "../../types";
import {
  arrowDirection,
  balancedColumns,
  drawableBreakdown,
  formatChange,
  formatFraction,
  hasChange,
  heroVisual,
  isTextValue,
  metricStatus,
  pickHeroIndex,
  resolveKpiTone,
  sparklineGeometry,
  toFraction,
  type KpiTone,
} from "./kpi";

export interface KpiVisualizationProps {
  data: KpiVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
}

// Visualizations render inside a chat panel that is much narrower than the
// window, so layout is driven by the container (flex wrapping and cell
// min-widths) rather than by Tailwind's viewport breakpoints.

/** Below this a cell wraps to its own row. */
const CELL_MIN_PX = 150;

const CHIP_TONE: Record<KpiTone, string> = {
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  bad: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const DOT_TONE: Record<KpiTone, string> = {
  good: "bg-emerald-600 dark:bg-emerald-400",
  bad: "bg-red-600 dark:bg-red-400",
  warning: "bg-amber-600 dark:bg-amber-400",
  neutral: "bg-gray-500",
};
const NOTE_TONE: Record<KpiTone, string> = {
  good: "text-gray-500 dark:text-gray-400",
  neutral: "text-gray-500 dark:text-gray-400",
  warning: "text-amber-700 dark:text-amber-300",
  bad: "text-red-700 dark:text-red-300",
};
const BREAKDOWN_COLORS = ["bg-blue-500", "bg-teal-500", "bg-amber-500", "bg-violet-500", "bg-pink-500"];

function Delta({ metric }: { metric: KpiMetric }) {
  const showChange = hasChange(metric);
  if (!showChange && !metric.changeLabel && !metric.previous) return null;
  const dir = arrowDirection(metric);
  const Arrow = dir > 0 ? ArrowUp : dir < 0 ? ArrowDown : Minus;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] tabular-nums text-gray-500 dark:text-gray-400">
      {showChange && (
        <span
          className={cn(
            "inline-flex items-center gap-[3px] rounded-full py-px pl-[5px] pr-[7px] font-semibold leading-normal",
            CHIP_TONE[resolveKpiTone(metric)],
          )}
        >
          <Arrow size={11} strokeWidth={2.75} aria-hidden />
          {formatChange(metric.change!)}
        </span>
      )}
      {metric.changeLabel && <span>{metric.changeLabel}</span>}
      {metric.previous && <span>was {metric.previous}</span>}
    </div>
  );
}

function Meter({ metric }: { metric: KpiMetric }) {
  if (!metric.meter) return null;
  const fraction = toFraction(metric.meter.value);
  const status = metricStatus(metric);
  return (
    <div className="flex flex-col gap-1">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={fraction}
        aria-label={metric.meter.label ?? metric.label}
        className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
      >
        <div
          className={cn("h-full rounded-full", status ? DOT_TONE[status] : "bg-gray-600 dark:bg-gray-300")}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {formatFraction(metric.meter.value)}
        {metric.meter.label ? ` ${metric.meter.label}` : ""}
      </span>
    </div>
  );
}

function BreakdownBar({ metric }: { metric: KpiMetric }) {
  const items = drawableBreakdown(metric);
  if (items.length === 0) return null;
  return (
    <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {items.map((b, i) => (
        <span key={i} className={BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]} style={{ flex: b.share }} />
      ))}
    </div>
  );
}

/** Hero: bar plus a full legend. Satellite: bar plus a one-line summary. */
function Breakdown({ metric, hero }: { metric: KpiMetric; hero: boolean }) {
  const items = metric.breakdown ?? [];
  if (items.length === 0) return null;
  const share = (s: number | undefined | null) => (s !== undefined && s !== null ? formatFraction(s) : "");
  if (!hero) {
    return (
      <div className="flex flex-col gap-1">
        <BreakdownBar metric={metric} />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {items.map((b) => [b.label, share(b.share)].filter(Boolean).join(" ")).join(" · ")}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <BreakdownBar metric={metric} />
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 gap-y-1 text-[0.8125rem] tabular-nums">
        {items.map((b, i) => (
          <div key={i} className="contents">
            <span className={cn("h-2 w-2 rounded-sm", BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length])} />
            <dt className="truncate text-gray-700 dark:text-gray-300">{b.label}</dt>
            <dd className="m-0 text-right font-semibold text-gray-900 dark:text-gray-100">{b.value}</dd>
            <dd className="m-0 min-w-[3.2em] text-right text-gray-500 dark:text-gray-400">{share(b.share)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Sparkline({ values, width, height }: { values: number[]; width: number; height: number }) {
  const geo = sparklineGeometry(values, width, height);
  if (!geo) return null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className="block w-full overflow-visible text-blue-500 dark:text-blue-400"
      style={{ height }}
    >
      <path d={geo.area} fill="currentColor" fillOpacity={0.1} />
      <path d={geo.line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* Stretched to its column, so the end dot is a round-capped zero-length
          stroke: non-scaling, it stays a circle at any aspect ratio. */}
      <path d={`M${geo.end.x} ${geo.end.y}h0`} stroke="currentColor" strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Everything a metric carries, stacked. In the hero, the one visual shown
 * beside the value (`heroVisual`) is left out here.
 */
function MetricBody({ metric, hero }: { metric: KpiMetric; hero: boolean }) {
  const visual = hero ? heroVisual(metric) : null;
  const status = metricStatus(metric);
  const text = isTextValue(metric.value);
  const inlineSpark = !hero && metric.sparkline && metric.sparkline.length > 1;
  return (
    <div className={cn("flex min-w-0 flex-col", hero ? "gap-2" : "gap-1.5")}>
      <div
        className={cn(
          "flex items-center gap-1.5 font-semibold uppercase leading-[1.35] tracking-[0.05em] text-gray-600 dark:text-gray-400 [overflow-wrap:anywhere]",
          hero ? "text-xs" : "text-[0.6875rem]",
        )}
      >
        {status && (
          <span aria-label={status} className={cn("h-[7px] w-[7px] flex-none rounded-full", DOT_TONE[status])} />
        )}
        {metric.label}
      </div>
      <div className="flex min-w-0 items-end justify-between gap-2.5">
        <div className="flex min-w-0 items-baseline gap-1">
          <span
            className={cn(
              "tabular-nums text-gray-900 dark:text-gray-100 [overflow-wrap:anywhere]",
              text
                ? "text-base font-semibold leading-snug"
                : hero
                  ? "text-[2.25rem] font-bold leading-[1.1] tracking-[-0.03em]"
                  : "text-[1.3125rem] font-bold leading-[1.1] tracking-[-0.02em]",
            )}
          >
            {metric.value}
          </span>
          {metric.unit && <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{metric.unit}</span>}
        </div>
        {inlineSpark && (
          <div className="w-16 flex-none pb-1">
            <Sparkline values={metric.sparkline!} width={64} height={24} />
          </div>
        )}
      </div>
      <Delta metric={metric} />
      {visual !== "meter" && <Meter metric={metric} />}
      {!hero && <Breakdown metric={metric} hero={false} />}
      {metric.note && (
        <div className={cn("flex gap-1.5 text-[0.8125rem] leading-snug", NOTE_TONE[status ?? "neutral"])}>
          <Info size={13} className="mt-0.5 flex-none" aria-hidden />
          <span>{metric.note}</span>
        </div>
      )}
    </div>
  );
}

function HeroBand({ metric }: { metric: KpiMetric }) {
  const visual = heroVisual(metric);
  // The visual sits beside the value while both flex bases fit (~520px) and
  // wraps beneath it below that.
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-4 px-4 pb-[18px] pt-4">
      <div className="min-w-0" style={{ flex: "9 1 240px" }}>
        <MetricBody metric={metric} hero />
      </div>
      {visual && (
        <div className="min-w-0" style={{ flex: "11 1 260px" }}>
          {visual === "breakdown" && <Breakdown metric={metric} hero />}
          {visual === "sparkline" && <Sparkline values={metric.sparkline!} width={300} height={64} />}
          {visual === "meter" && <Meter metric={metric} />}
        </div>
      )}
    </div>
  );
}

/**
 * One bordered panel. "bento" opens with a full-width hero band for its
 * primary metric; "row" and "grid" are the same cells without one. Cells wrap
 * in balanced rows (up to 4, or 2 for "grid") and a short last row stretches,
 * so no cell is ever left empty. Payload semantics live in `./kpi`, shared
 * with every other KPI renderer.
 */
export function KpiVisualization({ data }: KpiVisualizationProps) {
  const { metrics, layout = "row" } = data;
  if (metrics.length === 0) return null;

  const heroIdx = layout === "bento" ? pickHeroIndex(metrics) : -1;
  const cells = metrics.filter((_, i) => i !== heroIdx);
  const cols = balancedColumns(cells.length, layout === "grid" ? 2 : 4);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {heroIdx >= 0 && <HeroBand metric={metrics[heroIdx]} />}
      {cells.length > 0 && (
        // Hairline grid: every cell draws its top and left rule and overlaps its
        // neighbours by 1px; the panel's overflow clips the outer ones.
        <div className="flex flex-wrap">
          {cells.map((metric, i) => (
            <div
              key={i}
              className="-ml-px -mt-px border-l border-t border-gray-200 px-4 py-3.5 dark:border-gray-800"
              style={{ flex: `1 1 calc(100% / ${cols})`, minWidth: `min(100%, ${CELL_MIN_PX}px)` }}
            >
              <MetricBody metric={metric} hero={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
