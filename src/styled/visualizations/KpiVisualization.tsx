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

// Original row/grid card — kept identical so existing threads render unchanged.
function KpiMetricCard({ metric, color, animate }: { metric: KpiMetric; color: string; animate: boolean }) {
  const trendIcon = metric.trend === "up" ? <ArrowUp size={16} className="text-green-500" /> :
    metric.trend === "down" ? <ArrowDown size={16} className="text-red-500" /> :
    metric.trend === "neutral" ? <Minus size={14} className="text-gray-400" /> : null;

  const trendColor = metric.trend === "up" ? "text-green-500" :
    metric.trend === "down" ? "text-red-500" : "text-gray-500";

  const sparklineData = metric.sparkline?.map((value, idx) => ({ value, idx }));

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 relative overflow-hidden">
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
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{metric.label}</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-2xl font-bold">{metric.value}</span>
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
            "block font-semibold uppercase tracking-wider",
            palette.label,
            isHero ? "text-xs" : "text-[0.7rem]",
          )}
        >
          {metric.label}
        </span>
        <div className={cn("flex items-baseline gap-1", isHero ? "mt-2" : "mt-1")}>
          <span
            className={cn(
              "font-extrabold tabular-nums text-gray-900 dark:text-gray-100 leading-tight tracking-tight",
              isHero ? "text-4xl sm:text-5xl" : "text-2xl",
            )}
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
  const satGridClass =
    satCols === 2 ? "sm:grid-cols-2" : satCols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

  return (
    <div className="w-full grid gap-4 md:[grid-template-columns:minmax(0,5fr)_minmax(0,7fr)] items-stretch">
      <div className="md:min-h-[220px]">
        <KpiBentoCard metric={hero} index={heroIdx} isHero animate={animate} />
      </div>
      <div className={cn("grid gap-4 grid-cols-2", satGridClass)}>
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

  return (
    <div className={cn("w-full", isGrid ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "flex gap-4 flex-wrap")}>
      {metrics.map((metric, idx) => (
        <div key={idx} className={cn(!isGrid && "flex-1 min-w-[200px]")}>
          <KpiMetricCard metric={metric} color={metric.color || colors[idx % colors.length]} animate={animate} />
        </div>
      ))}
    </div>
  );
}
