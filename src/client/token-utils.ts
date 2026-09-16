/**
 * Utility functions for parsing and managing JWT tokens.
 * Used for proactive token refresh before expiration.
 */

/**
 * Parse the expiry time from a JWT token.
 * Returns the expiry timestamp in milliseconds, or null if parsing fails.
 */
export function parseTokenExpiry(token: string): number | null {
  const claims = parseTokenClaims(token);
  return typeof claims?.exp === "number" ? claims.exp * 1000 : null;
}

/**
 * The thread an embed token is bound to, or null if it names none. Every
 * request carrying the token acts on this thread, whatever thread the
 * session object it was stored on is showing.
 */
export function parseTokenThreadId(token: string): string | null {
  const claims = parseTokenClaims(token);
  return typeof claims?.thread_id === "string" ? claims.thread_id : null;
}

/** The unverified claims of a JWT, or null if it is not one. */
function parseTokenClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded: unknown = JSON.parse(atob(base64));
    return decoded && typeof decoded === "object"
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * How long before expiry a live connection treats its token as due for
 * refresh: long enough for one refresh round-trip to land first.
 */
export const TOKEN_REFRESH_LEAD_MS = 60_000;

/**
 * Check if a token is expiring soon (within the given threshold).
 */
export function isTokenExpiringSoon(
  token: string,
  thresholdMs: number
): boolean {
  const expiry = parseTokenExpiry(token);
  if (expiry === null) return true;
  return expiry - Date.now() <= thresholdMs;
}

/**
 * Check if a token has already expired.
 */
export function isTokenExpired(token: string): boolean {
  const expiry = parseTokenExpiry(token);
  if (expiry === null) return true;
  return Date.now() >= expiry;
}

/**
 * Get the time remaining until token expiry in milliseconds.
 */
export function getTimeUntilExpiry(token: string): number {
  const expiry = parseTokenExpiry(token);
  if (expiry === null) return 0;
  return Math.max(0, expiry - Date.now());
}
