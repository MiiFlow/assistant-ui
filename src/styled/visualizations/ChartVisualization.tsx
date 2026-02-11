import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from "recharts";
import type { ChartVisualizationData, ChartDataType, VisualizationConfig } from "../../types";

export interface ChartVisualizationProps {
  data: ChartVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
}

const DEFAULT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
];

export function ChartVisualization({ data, config, isStreaming = false }: ChartVisualizationProps) {
  const { chartType, series, xAxis, yAxis } = data;
  const colors = config?.colors || DEFAULT_COLORS;
  const height = config?.height || 300;
  const showLegend = config?.legend !== false;
  const showGrid = config?.grid !== false;
  const showTooltip = config?.tooltip !== false;
  const animate = config?.animate !== false && !isStreaming;
  const stacked = config?.stacked || false;

  const transformDataForRecharts = () => {
    if (chartType === "pie") {
      const pieData = series[0]?.data || [];
      return pieData.map((item: any, idx: number) => ({
        name: item.name || item.x || `Item ${idx + 1}`,
        value: item.value ?? item.y ?? 0,
      }));
    }
    const dataMap = new Map<string | number, Record<string, any>>();
    series.forEach((s) => {
      s.data.forEach((point: any) => {
        const xVal = point.x ?? point.name;
        if (!dataMap.has(xVal)) dataMap.set(xVal, { x: xVal });
        dataMap.get(xVal)![s.name] = point.y ?? point.value ?? 0;
      });
    });
    return Array.from(dataMap.values());
  };

  const chartData = transformDataForRecharts();
  const commonProps = { data: chartData, margin: { top: 10, right: 30, left: 0, bottom: 0 } };

  const axisStyle = { fontSize: 12 };
  const tooltipStyle = {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  };

  const renderChart = () => {
    switch (chartType as ChartDataType) {
      case "line":
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey="x" {...axisStyle} tickLine={false} padding={{ left: 10, right: 10 }} />
            <YAxis {...axisStyle} tickLine={false} width={40} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && <Legend />}
            {series.map((s, idx) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color || colors[idx % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={animate} />
            ))}
          </LineChart>
        );
      case "bar":
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey="x" {...axisStyle} tickLine={false} padding={{ left: 10, right: 10 }} />
            <YAxis {...axisStyle} tickLine={false} width={40} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && <Legend />}
            {series.map((s, idx) => (
              <Bar key={s.name} dataKey={s.name} fill={s.color || colors[idx % colors.length]} stackId={stacked ? "stack" : undefined} isAnimationActive={animate} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
      case "area":
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey="x" {...axisStyle} tickLine={false} padding={{ left: 10, right: 10 }} />
            <YAxis {...axisStyle} tickLine={false} width={40} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && <Legend />}
            {series.map((s, idx) => (
              <Area key={s.name} type="monotone" dataKey={s.name} stroke={s.color || colors[idx % colors.length]} fill={s.color || colors[idx % colors.length]} fillOpacity={0.3} stackId={stacked ? "stack" : undefined} isAnimationActive={animate} />
            ))}
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && <Legend />}
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={Math.min(height, 300) / 3} isAnimationActive={animate} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
              {chartData.map((_, idx) => <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />)}
            </Pie>
          </PieChart>
        );
      case "scatter":
        return (
          <ScatterChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey="x" type="number" {...axisStyle} tickLine={false} name={xAxis?.label} padding={{ left: 10, right: 10 }} />
            <YAxis {...axisStyle} tickLine={false} name={yAxis?.label} width={40} />
            {showTooltip && <Tooltip contentStyle={tooltipStyle} />}
            {showLegend && <Legend />}
            {series.map((s, idx) => (
              <Scatter key={s.name} name={s.name} data={s.data.map((p: any) => ({ x: p.x, y: p.y }))} fill={s.color || colors[idx % colors.length]} isAnimationActive={animate} />
            ))}
          </ScatterChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {renderChart() || <></>}
      </ResponsiveContainer>
    </div>
  );
}
