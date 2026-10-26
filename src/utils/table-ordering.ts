/** Nulls remain last in either direction. No sort preserves the agent's order. */
export function compareTableValues(
  a: unknown,
  b: unknown,
  direction: "asc" | "desc",
  type?: string,
): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  let result: number;
  if (type === "date") result = Date.parse(String(a)) - Date.parse(String(b));
  else if (typeof a === "number" && typeof b === "number") result = a - b;
  else result = String(a).localeCompare(String(b));
  return Number.isNaN(result) ? 0 : direction === "asc" ? result : -result;
}
