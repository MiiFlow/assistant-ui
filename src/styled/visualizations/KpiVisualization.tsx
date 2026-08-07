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

// Per-family palette for the bento layout. Each entry covers the surfaces a
// bento card needs: a tinted gradient background, an accent stripe, and the
// label/sparkline color.
const BENTO_PALETTE = [
  { label: "text-blue-700 dark:text-blue-300", stripeFrom: "#3b82f6", stripeTo: "#2563eb", tintFrom: "rgba(59,130,246,0.10)", tintMid: "rgba(59,130,246,0.025)", border: "border-blue-200 dark:border-blue-900", borderHover: "hover:border-blue-400 dark:hover:border-blue-700", spark: "#3b82f6", glow: "0 8px 24px rgba(59,130,246,0.18)" },
  { label: "text-emerald-700 dark:text-emerald-300", stripeFrom: "#10b981", stripeTo: "#059669", tintFrom: "rgba(16,185,129,0.10)", tintMid: "rgba(16,185,129,0.025)", border: "border-emerald-200 dark:border-emerald-900", borderHover: "hover:border-emerald-400 dark:hover:border-emerald-700", spark: "#10b981", glow: "0 8px 24px rgba(16,185,129,0.18)" },
  { label: "text-purple-700 dark:text-purple-300", stripeFrom: "#a855f7", stripeTo: "#9333ea", tintFrom: "rgba(168,85,247,0.10)", tintMid: "rgba(168,85,247,0.025)", border: "border-purple-200 dark:border-purple-900", borderHover: "hover:border-purple-400 dark:hover:border-purple-700", spark: "#a855f7", glow: "0 8px 24px rgba(168,85,247,0.18)" },
  { label: "text-orange-700 dark:text-orange-300", stripeFrom: "#f97316", stripeTo: "#ea580c", tintFrom: "rgba(249,115,22,0.10)", tintMid: "rgba(249,115,22,0.025)", border: "border-orange-200 dark:border-orange-900", borderHover: "hover:border-orange-400 dark:hover:border-orange-700", spark: "#f97316", glow: "0 8px 24px rgba(249,115,22,0.18)" },
  { label: "text-pink-700 dark:text-pink-300", stripeFrom: "#ec4899", stripeTo: "#db2777", tintFrom: "rgba(236,72,153,0.10)", tintMid: "rgba(236,72,153,0.025)", border: "border-pink-200 dark:border-pink-900", borderHover: "hover:border-pink-400 dark:hover:border-pink-700", spark: "#ec4899", glow: "0 8px 24px rgba(236,72,153,0.18)" },
  { label: "text-teal-700 dark:text-teal-300", stripeFrom: "#14b8a6", stripeTo: "#0d9488", tintFrom: "rgba(20,184,166,0.10)", tintMid: "rgba(20,184,166,0.025)", border: "border-teal-200 dark:border-teal-900", borderHover: "hover:border-teal-400 dark:hover:border-teal-700", spark: "#14b8a6", glow: "0 8px 24px rgba(20,184,166,0.18)" },
];

function paletteForIndex(idx: number) {
  return BENTO_PALETTE[idx % BENTO_PALETTE.length];
}

// Visualizations render inside a chat panel that is much narrower than the
// window, so layout here is driven by the container (intrinsic grid/flex sizing
// and `cqi` units) rather than by Tailwind's viewport breakpoints.
const GRID_GAP_PX = 16; // gap-4

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
  index,
  isHero,
  animate,
}: {
  metric: KpiMetric;
  index: number;
  isHero: boolean;
  animate: boolean;
}) {
  const palette = paletteForIndex(index);
  const sparklineData = metric.sparkline?.map((value, idx) => ({ value, idx }));
  const showSparkline = isHero && sparklineData && sparklineData.length > 1;

  const TrendIcon = metric.trend === "up" ? ArrowUp : metric.trend === "down" ? ArrowDown : Minus;
  const trendPillColor =
    metric.trend === "up"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : metric.trend === "down"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  const showTrend = metric.change !== undefined && metric.change !== null;

  return (
    <div
      className={cn(
        "relative h-full rounded-xl border bg-white dark:bg-gray-900 overflow-hidden transition-all",
        palette.border,
        palette.borderHover,
        "hover:-translate-y-0.5",
        isHero ? "p-5" : "p-4",
      )}
      style={{
        ...CARD_CONTAINER,
        background: isHero
          ? `linear-gradient(135deg, ${palette.tintFrom} 0%, ${palette.tintMid} 60%, transparent 100%), var(--kpi-bg, white)`
          : undefined,
      }}
    >
      {/* Left accent stripe */}
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: isHero ? 4 : 3,
          background: `linear-gradient(180deg, ${palette.stripeFrom}, ${palette.stripeTo})`,
        }}
      />

      {showSparkline && (
        <div
          aria-hidden
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{ height: 56, opacity: 0.35 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.spark} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={palette.spark} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={palette.spark}
                fill={`url(#spark-${index})`}
                strokeWidth={1.5}
                isAnimationActive={animate}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className={cn("relative z-10", isHero ? "pl-1" : "pl-0.5")}>
        <span
          className={cn(
            "block font-semibold uppercase tracking-wider [overflow-wrap:anywhere]",
            palette.label,
            isHero ? "text-xs" : "text-[0.7rem]",
          )}
        >
          {metric.label}
        </span>
        <div className={cn("flex items-baseline gap-1 min-w-0", isHero ? "mt-2" : "mt-1")}>
          <span
            className="font-extrabold tabular-nums text-gray-900 dark:text-gray-100 leading-tight tracking-tight [overflow-wrap:anywhere]"
            style={{
              // Scales with the card, not the window — a satellite in a narrow
              // chat panel steps down instead of clipping.
              fontSize: isHero
                ? "clamp(1.75rem, 11cqi, 2.75rem)"
                : "clamp(1.125rem, 10cqi, 1.5rem)",
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
          <div className={cn("flex items-center gap-1.5 flex-wrap", isHero ? "mt-3" : "mt-2")}>
            {showTrend && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums",
                  trendPillColor,
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

function KpiBentoLayout({ metrics, animate }: { metrics: KpiMetric[]; animate: boolean }) {
  if (metrics.length === 0) return null;
  if (metrics.length === 1) {
    return (
      <div className="w-full">
        <KpiBentoCard metric={metrics[0]} index={0} isHero animate={animate} />
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
    <div className="w-full flex flex-wrap gap-4 items-stretch">
      <div className="min-w-0" style={{ flex: "5 1 260px" }}>
        <KpiBentoCard metric={hero} index={heroIdx} isHero animate={animate} />
      </div>
      <div
        className="min-w-0 grid gap-4"
        style={{ flex: "7 1 320px", gridTemplateColumns: autoColumns(satCols, 140) }}
      >
        {satellites.map(({ m, i }) => (
          <KpiBentoCard key={i} metric={m} index={i} isHero={false} animate={animate} />
        ))}
      </div>
    </div>
  );
}

export function KpiVisualization({ data, config, isStreaming = false }: KpiVisualizationProps) {
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
