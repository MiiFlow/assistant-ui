import { useMemo, useState } from "react";
import { Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";
import type { TableVisualizationData, TableColumn, TableColumnType, VisualizationConfig } from "../../types";

export interface TableVisualizationProps {
  data: TableVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
}

type Order = "asc" | "desc";

const badgeColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  success: "bg-green-100 text-green-700",
  enabled: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  processing: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
  disabled: "bg-red-100 text-red-700",
  inactive: "bg-gray-100 text-gray-700",
  draft: "bg-gray-100 text-gray-700",
};

function formatCellValue(value: unknown, column: TableColumn): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-gray-400">-</span>;

  const type = column.type || "string";

  switch (type as TableColumnType) {
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "currency":
      return typeof value === "number"
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
        : String(value);
    case "date":
      try { return new Date(value as string | number).toLocaleDateString(); }
      catch { return String(value); }
    case "badge": {
      const strValue = String(value).toLowerCase().replace(/\s+/g, "_");
      const colorClass = badgeColors[strValue] || "bg-gray-100 text-gray-700";
      return <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", colorClass)}>{String(value)}</span>;
    }
    case "link":
      return <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{String(value)}</a>;
    case "boolean":
      return value ? <Check size={18} className="text-green-500" /> : <X size={18} className="text-gray-400" />;
    case "progress": {
      const numValue = typeof value === "number" ? value : parseFloat(String(value));
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, numValue))}%` }} />
          </div>
          <span className="text-xs text-gray-500">{numValue.toFixed(0)}%</span>
        </div>
      );
    }
    default:
      return String(value);
  }
}

function descendingComparator(a: Record<string, unknown>, b: Record<string, unknown>, orderBy: string): number {
  const aValue = a[orderBy];
  const bValue = b[orderBy];
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  if (typeof aValue === "number" && typeof bValue === "number") return bValue - aValue;
  return String(bValue).localeCompare(String(aValue));
}

export function TableVisualization({ data, config }: TableVisualizationProps) {
  const { columns, rows } = data;
  const sortable = config?.sortable !== false;
  const paginated = config?.paginated || false;
  const pageSize = config?.pageSize || 10;

  const [order, setOrder] = useState<Order>("asc");
  const [orderBy, setOrderBy] = useState<string>(columns[0]?.key || "");
  const [page, setPage] = useState(0);

  const handleRequestSort = (key: string) => {
    setOrder(orderBy === key && order === "asc" ? "desc" : "asc");
    setOrderBy(key);
  };

  const processedRows = useMemo(() => {
    let sorted = [...rows];
    if (sortable && orderBy) {
      sorted.sort((a, b) => order === "desc" ? descendingComparator(a, b, orderBy) : -descendingComparator(a, b, orderBy));
    }
    if (paginated) sorted = sorted.slice(page * pageSize, (page + 1) * pageSize);
    return sorted;
  }, [rows, order, orderBy, page, pageSize, sortable, paginated]);

  const totalPages = Math.ceil(rows.length / pageSize);

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-3 py-2 font-semibold bg-gray-50 dark:bg-gray-800 whitespace-nowrap text-left",
                  sortable && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
                style={{ width: col.width, textAlign: col.align || "left" }}
                onClick={() => sortable && handleRequestSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortable && orderBy === col.key && (
                    order === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-3 py-2 whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis"
                  style={{ textAlign: col.align || "left" }}
                >
                  {formatCellValue(row[col.key], col)}
                </td>
              ))}
            </tr>
          ))}
          {processedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {paginated && rows.length > pageSize && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-sm">
          <span className="text-gray-500">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
