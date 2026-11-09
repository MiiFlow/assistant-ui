const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The calendar day a date-only `YYYY-MM-DD` table value names, as a Date at
 * UTC midnight of that day. A value of that shape naming a day that does not
 * exist (`2026-02-30`) gives an Invalid Date rather than rolling over to
 * another day. Anything else, timestamps included, gives null.
 *
 * `new Date("2026-07-15")` is also UTC midnight, but shown in the viewer's
 * zone it is 7/14 anywhere west of UTC. Format the returned Date with
 * `timeZone: "UTC"` to show the day that was stored.
 */
export function parseTableDateOnly(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : new Date(Number.NaN);
}
