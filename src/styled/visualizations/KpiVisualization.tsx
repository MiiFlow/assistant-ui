import { ArrowUp, ChevronDown, Circle } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "../../utils/cn";
import type { KpiVisualizationData, KpiMetric, VisualizationConfig } from "../../types";

export interface KpiVisualizationProps {
  data: KpiVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
}

const DEFAULT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

function KpiMetricCard({ metric, color, animate }: { metric: KpiMetric; color: string; animate: boolean }) {
  const trendIcon = metric.trend === "up" ? <ArrowUp size={16} className="text-green-500" /> :
    metric.trend === "down" ? <ChevronDown size={16} className="text-red-500" /> :
    metric.trend === "neutral" ? <Circle size={14} className="text-gray-400" /> : null;

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
        {(metric.trend || metric.change) && (
          <div className="flex items-center gap-1 mt-2">
            {trendIcon}
            {metric.change && <span className={cn("text-sm font-medium", trendColor)}>{metric.change}</span>}
            {metric.changeLabel && <span className="text-xs text-gray-500">{metric.changeLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function KpiVisualization({ data, config, isStreaming = false }: KpiVisualizationProps) {
  const { metrics, layout = "row" } = data;
  const colors = config?.colors || DEFAULT_COLORS;
  const animate = config?.animate !== false && !isStreaming;
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
