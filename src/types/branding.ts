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
}
