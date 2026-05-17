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

    if (branding?.fontFamily) {
      vars["--chat-font-family"] = branding.fontFamily;
    }

    if (branding?.approvalAccentColor) {
      vars["--chat-approval-accent"] = branding.approvalAccentColor;
      vars["--chat-approval-accent-soft"] = branding.approvalAccentColor;
    }

    if (branding?.approveButtonColor) {
      vars["--chat-approve-bg"] = branding.approveButtonColor;
      vars["--chat-approve-bg-hover"] =
        branding.approveButtonHoverColor || branding.approveButtonColor;
    }

    if (branding?.rejectButtonHoverColor) {
      vars["--chat-reject-bg-hover"] = branding.rejectButtonHoverColor;
    }

    if (branding?.clarificationAccentColor) {
      vars["--chat-clarification-accent"] = branding.clarificationAccentColor;
      vars["--chat-clarification-accent-soft"] = branding.clarificationAccentColor;
    }

    // Activity accent is independent of brand primary so callers whose
    // primary is neutral can still surface a vivid in-progress signal in
    // the reasoning panel. Unset → falls back to --chat-primary at usage.
    if (branding?.activityAccentColor) {
      vars["--chat-activity"] = branding.activityAccentColor;
    }

    return vars as React.CSSProperties;
  }, [branding, overrides?.iconColor]);
}
