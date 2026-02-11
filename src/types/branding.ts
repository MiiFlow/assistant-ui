/**
 * Branding types for theming chat UI components.
 */

export interface BrandingData {
  customName?: string;
  messageFontSize?: number;
  welcomeMessage?: string;
  chatboxPlaceholder?: string;
  backgroundBubbleColor?: string;
  headerBackgroundColor?: string;
  showHeader?: boolean;
  rotatingPlaceholders?: string[];
  presetQuestions?: string[];
  chatbotLogo?: string;
  assistantAvatar?: string;
}
