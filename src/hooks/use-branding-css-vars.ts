import { useMemo } from "react";
import type { BrandingData } from "../types/branding";
import { getContrastTextColor } from "../utils/color-contrast";

/**
 * Converts BrandingData into CSS custom properties for chat-ui theming.
 * Returns a CSSProperties object that can be spread onto a container element.
 */
export function useBrandingCSSVars(
  branding: BrandingData | null | undefined,
  overrides?: { iconColor?: string }
): React.CSSProperties {
  return useMemo(() => {
    if (!branding && !overrides?.iconColor) return {};

    const vars: Record<string, string> = {};

    const primaryColor =
      branding?.backgroundBubbleColor || overrides?.iconColor;
    if (primaryColor) {
      vars["--chat-primary"] = primaryColor;
      vars["--chat-user-message-bg"] = primaryColor;
      vars["--chat-user-message-text"] = getContrastTextColor(primaryColor);
    }

    if (branding?.headerBackgroundColor) {
      vars["--chat-header-bg"] = branding.headerBackgroundColor;
    }

    if (branding?.messageFontSize) {
      vars["--chat-message-font-size"] = `${branding.messageFontSize}px`;
    }

    return vars as React.CSSProperties;
  }, [branding, overrides?.iconColor]);
}
