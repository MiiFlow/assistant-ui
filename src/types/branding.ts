/**
 * Branding types for theming chat UI components.
 */

export interface BrandingData {
  customName?: string;
  messageFontSize?: number;
  fontFamily?: string;
  welcomeMessage?: string;
  chatboxPlaceholder?: string;
  backgroundBubbleColor?: string;
  headerBackgroundColor?: string;
  showHeader?: boolean;
  rotatingPlaceholders?: string[];
  presetQuestions?: string[];
  chatbotLogo?: string;
  assistantAvatar?: string;
  approvalAccentColor?: string;
  approveButtonColor?: string;
  approveButtonHoverColor?: string;
  rejectButtonHoverColor?: string;
  clarificationAccentColor?: string;
  /**
   * Accent color used for in-progress / live indicators in the reasoning
   * panel: the running-state halo, animated caret, header wave, rail-flow
   * gradient, and active-row wash. Defaults to `backgroundBubbleColor`
   * (i.e. `--chat-primary`); set this independently when the brand
   * primary is neutral, so activity stays distinguishable.
   */
  activityAccentColor?: string;
}
