/**
 * Format a date for display in chat messages.
 */

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

const FULL_FORMAT: Intl.DateTimeFormatOptions = {
  ...DATE_FORMAT,
  year: "numeric",
  ...TIME_FORMAT,
};

/**
 * Format a timestamp for display.
 * - Today: "2:30 PM"
 * - This year: "Dec 15, 2:30 PM"
 * - Other years: "Dec 15, 2024, 2:30 PM"
 */
export function formatMessageTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString("en-US", TIME_FORMAT);
  }

  const isThisYear = d.getFullYear() === now.getFullYear();

  if (isThisYear) {
    return `${d.toLocaleDateString("en-US", DATE_FORMAT)}, ${d.toLocaleTimeString("en-US", TIME_FORMAT)}`;
  }

  return d.toLocaleDateString("en-US", FULL_FORMAT);
}

/**
 * Format a relative time (e.g., "2 minutes ago").
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return formatMessageTime(d);
}
