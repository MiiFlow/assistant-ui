/**
 * Utility functions for parsing and managing JWT tokens.
 * Used for proactive token refresh before expiration.
 */

/**
 * Parse the expiry time from a JWT token.
 * Returns the expiry timestamp in milliseconds, or null if parsing fails.
 */
export function parseTokenExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = atob(base64);
    const decoded = JSON.parse(jsonPayload);

    if (typeof decoded.exp === "number") {
      return decoded.exp * 1000;
    }

    return null;
  } catch {
    return null;
  }
}

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
