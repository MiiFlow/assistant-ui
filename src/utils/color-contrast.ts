/**
 * Parse a CSS color string (hex, rgb, rgba) into [r, g, b] values.
 * Returns null if the color cannot be parsed.
 */
function parseColor(color: string): [number, number, number] | null {
  // Hex: #RGB, #RRGGBB
  const hex = color.trim();
  if (hex.startsWith("#")) {
    const h = hex.slice(1);
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ];
    }
    if (h.length >= 6) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = color.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/
  );
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }

  return null;
}

/**
 * Compute the relative luminance of an sRGB color per WCAG 2.0.
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Given a background color string, return the best contrast text color.
 * Returns "#ffffff" for dark backgrounds and "#1D2033" for light backgrounds.
 * Falls back to "#ffffff" if the color cannot be parsed.
 */
export function getContrastTextColor(bgColor: string): string {
  const rgb = parseColor(bgColor);
  if (!rgb) return "#ffffff";

  const lum = relativeLuminance(...rgb);
  // WCAG threshold: luminance > 0.179 means the background is "light"
  return lum > 0.179 ? "#1D2033" : "#ffffff";
}
