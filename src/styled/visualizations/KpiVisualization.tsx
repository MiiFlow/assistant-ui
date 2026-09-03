/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * component: KPI bento · genre: modern-minimal · tone: utilitarian
 * interaction: static data surface · contrast: pass (40–41) · mobile: pass (34, 49–57)
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "../../utils/cn";
import type { KpiVisualizationData, KpiMetric, VisualizationConfig } from "../../types";

export interface KpiVisualizationProps {
  data: KpiVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
}

const DEFAULT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

// Visualizations render inside a chat panel that is much narrower than the
// window, so layout here is driven by the container (intrinsic grid/flex sizing
// and `cqi` units) rather than by Tailwind's viewport breakpoints.
const GRID_GAP_PX = 12; // gap-3

/**
 * Column template that never exceeds `maxCols` tracks but sheds columns as the
 * container narrows, keeping every card at least `minPx` wide. `min(100%, …)`
 * is the floor that stops a single card from overflowing a very narrow panel.
 */
function autoColumns(maxCols: number, minPx: number, gapPx = GRID_GAP_PX): string {
  const capped = `calc((100% - ${(maxCols - 1) * gapPx}px) / ${maxCols})`;
  return `repeat(auto-fit, minmax(min(100%, max(${minPx}px, ${capped})), 1fr))`;
}

/** Cards are their own query containers so `cqi` value sizing tracks card width. */
const CARD_CONTAINER = { containerType: "inline-size" as const };

// Original row/grid card — kept identical so existing threads render unchanged.
function KpiMetricCard({ metric, color, animate }: { metric: KpiMetric; color: string; animate: boolean }) {
  const trendIcon = metric.trend === "up" ? <ArrowUp size={16} className="text-green-500" /> :
    metric.trend === "down" ? <ArrowDown size={16} className="text-red-500" /> :
    metric.trend === "neutral" ? <Minus size={14} className="text-gray-400" /> : null;

  const trendColor = metric.trend === "up" ? "text-green-500" :
    metric.trend === "down" ? "text-red-500" : "text-gray-500";

  const sparklineData = metric.sparkline?.map((value, idx) => ({ value, idx }));

  return (
    <div
      className="h-full p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 relative overflow-hidden"
      style={CARD_CONTAINER}
    >
      {sparklineData && sparklineData.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Area type="monotone" dataKey="value" stroke={metric.color || color} fill={metric.color || color} strokeWidth={1} isAnimationActive={animate} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative z-10">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider [overflow-wrap:anywhere]">{metric.label}</span>
        <div className="flex items-baseline gap-1 mt-1 min-w-0">
          <span
            className="font-bold [overflow-wrap:anywhere]"
            style={{ fontSize: "clamp(1.25rem, 9cqi, 1.5rem)" }}
          >
            {metric.value}
          </span>
          {metric.unit && <span className="text-sm text-gray-500">{metric.unit}</span>}
        </div>
        {(metric.trend || metric.change !== undefined && metric.change !== null) && (
          <div className="flex items-center gap-1 mt-2">
            {trendIcon}
            {metric.change !== undefined && metric.change !== null && (
              <span className={cn("text-sm font-medium", trendColor)}>
                {typeof metric.change === "number"
                  ? `${metric.change > 0 ? "+" : ""}${metric.change}`
                  : metric.change}
              </span>
            )}
            {metric.changeLabel && <span className="text-xs text-gray-500">{metric.changeLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiBentoCard({
  metric,
  isHero,
  animate,
}: {
  metric: KpiMetric;
  isHero: boolean;
  animate: boolean;
}) {
  const sparklineData = metric.sparkline?.map((value, idx) => ({ value, idx }));
  const showSparkline = isHero && sparklineData && sparklineData.length > 1;

  const TrendIcon =
    metric.trend === "up"
      ? ArrowUp
      : metric.trend === "down"
        ? ArrowDown
        : Minus;
  const trendColor =
    metric.trend === "up"
      ? "text-emerald-700 dark:text-emerald-300"
      : metric.trend === "down"
        ? "text-red-700 dark:text-red-300"
        : "text-gray-600 dark:text-gray-300";
  const showTrend = metric.change !== undefined && metric.change !== null;

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
        isHero ? "p-5" : "p-4",
      )}
      style={{
        ...CARD_CONTAINER,
        minHeight: isHero ? 196 : 96,
      }}
    >
      {showSparkline && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 text-gray-400 dark:text-gray-600"
          style={{ height: 56, opacity: 0.35 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={sparklineData}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <Area
                type="monotone"
                dataKey="value"
                stroke="currentColor"
                fill="transparent"
                strokeWidth={1.25}
                isAnimationActive={animate}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative z-10 flex h-full min-w-0 flex-col">
        <span className="block text-[0.6875rem] font-semibold uppercase leading-[1.35] tracking-[0.04em] text-gray-600 dark:text-gray-400 [overflow-wrap:anywhere]">
          {metric.label}
        </span>
        <div
          className={cn(
            "flex min-w-0 items-baseline gap-1",
            isHero && !showTrend && !metric.changeLabel
              ? "mt-auto pt-4"
              : isHero
                ? "mt-2"
                : "mt-1",
          )}
        >
          <span
            className={cn(
              "font-bold tabular-nums text-gray-900 dark:text-gray-100 leading-[1.1] [overflow-wrap:anywhere]",
              isHero ? "tracking-[-0.03em]" : "tracking-[-0.015em]",
            )}
            style={{
              // Scales with the card, not the window — a satellite in a narrow
              // chat panel steps down instead of clipping.
              fontSize: isHero
                ? "clamp(1.75rem, 10cqi, 2.25rem)"
                : "clamp(1rem, 8cqi, 1.25rem)",
            }}
          >
            {metric.value}
          </span>
          {metric.unit && (
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {metric.unit}
            </span>
          )}
        </div>

        {(showTrend || metric.changeLabel) && (
          <div
            className={cn(
              "mt-auto flex flex-wrap items-center gap-1.5 pt-3",
              isHero && "pt-4",
            )}
          >
            {showTrend && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
                  trendColor,
                )}
              >
                <TrendIcon size={isHero ? 14 : 12} strokeWidth={2.5} />
                {typeof metric.change === "number"
                  ? `${metric.change > 0 ? "+" : ""}${metric.change}`
                  : metric.change}
              </span>
            )}
            {metric.changeLabel && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {metric.changeLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function pickHeroIndex(metrics: KpiMetric[]): number {
  const explicit = metrics.findIndex((m) => m.prominence === "primary");
  return explicit >= 0 ? explicit : 0;
}

function KpiBentoLayout({
  metrics,
  animate,
}: {
  metrics: KpiMetric[];
  animate: boolean;
}) {
  if (metrics.length === 0) return null;
  if (metrics.length === 1) {
    return (
      <div className="w-full">
        <KpiBentoCard metric={metrics[0]} isHero animate={animate} />
      </div>
    );
  }

  const heroIdx = pickHeroIndex(metrics);
  const hero = metrics[heroIdx];
  const satellites = metrics
    .map((m, i) => ({ m, i }))
    .filter(({ i }) => i !== heroIdx);

  const satCount = satellites.length;
  const satCols = satCount <= 3 ? Math.max(2, satCount) : satCount >= 7 ? 3 : 2;

  // Hero and satellites sit side by side (roughly 5:7) only while the container
  // can hold both flex bases; below that they stack. Flex basis is the container
  // query here — no viewport breakpoint involved.
  return (
    <div className="flex w-full flex-wrap items-stretch gap-3">
      <div className="min-w-0" style={{ flex: "5 1 260px" }}>
        <KpiBentoCard metric={hero} isHero animate={animate} />
      </div>
      <div
        className="grid min-w-0 gap-3"
        style={{
          flex: "7 1 320px",
          gridTemplateColumns: autoColumns(satCols, 168),
        }}
      >
        {satellites.map(({ m, i }) => (
          <KpiBentoCard key={i} metric={m} isHero={false} animate={animate} />
        ))}
      </div>
    </div>
  );
}

export function KpiVisualization({
  data,
  config,
  isStreaming = false,
}: KpiVisualizationProps) {
  const { metrics, layout = "row" } = data;
  const colors = config?.colors || DEFAULT_COLORS;
  const animate = config?.animate !== false && !isStreaming;

  if (layout === "bento") {
    return (
      <div className="w-full">
        <KpiBentoLayout metrics={metrics} animate={animate} />
      </div>
    );
  }

  const isGrid = layout === "grid";

  // "row" asks for one line of equal cards, but the line only holds as many as
  // the container can fit at a readable width — the rest wrap.
  return (
    <div
      className="w-full grid gap-4"
      style={{
        gridTemplateColumns: isGrid
          ? autoColumns(2, 200)
          : autoColumns(Math.max(metrics.length, 1), 170),
      }}
    >
      {metrics.map((metric, idx) => (
        <KpiMetricCard
          key={idx}
          metric={metric}
          color={metric.color || colors[idx % colors.length]}
          animate={animate}
        />
      ))}
    </div>
  );
}
