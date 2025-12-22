/**
 * Design tokens for the chat UI.
 * These map to CSS custom properties for easy theming.
 */

export const chatTokens = {
  spacing: {
    /** Vertical spacing between messages (16px) */
    messageBetween: "1rem",
    /** Message bubble horizontal padding (14px) */
    messagePx: "0.875rem",
    /** Message bubble vertical padding (10px) */
    messagePy: "0.625rem",
    /** Container padding (16px) */
    container: "1rem",
    /** Composer padding (16px) */
    composerPadding: "1rem",
  },

  typography: {
    message: {
      fontSize: "1rem",
      lineHeight: 1.5,
      letterSpacing: "0px",
    },
    caption: {
      fontSize: "0.875rem",
      lineHeight: 1.4,
    },
    small: {
      fontSize: "0.8125rem",
      lineHeight: 1.3,
    },
  },

  borderRadius: {
    message: "0.5rem",
    input: "1rem",
    panel: "0.5rem",
    button: "0.5rem",
    chip: "0.25rem",
  },

  colors: {
    // CSS custom property references
    primary: "var(--chat-primary, #106997)",
    secondary: "var(--chat-secondary, #56C18A)",
    error: "var(--chat-error, #B1001B)",
    warning: "var(--chat-warning, #DD9652)",

    // Message backgrounds
    messageBg: "var(--chat-message-bg, rgba(0, 0, 0, 0.03))",
    userMessageBg: "var(--chat-user-message-bg, var(--chat-primary, #106997))",

    // Panel backgrounds
    panelBg: "var(--chat-panel-bg, rgba(0, 0, 0, 0.02))",
    panelBorder: "var(--chat-panel-border, rgba(0, 0, 0, 0.06))",

    // Borders
    border: "var(--chat-border, rgba(0, 0, 0, 0.06))",
    borderHover: "var(--chat-border-hover, rgba(0, 0, 0, 0.12))",

    // Text
    text: "var(--chat-text, #1D2033)",
    subtle: "var(--chat-text-subtle, rgba(0, 0, 0, 0.5))",
    placeholder: "var(--chat-placeholder, rgba(0, 0, 0, 0.4))",

    // Status colors
    status: {
      pending: {
        main: "rgba(0, 0, 0, 0.3)",
        bg: "rgba(0, 0, 0, 0.05)",
      },
      running: {
        main: "rgb(99, 102, 241)",
        bg: "rgba(99, 102, 241, 0.08)",
      },
      completed: {
        main: "rgb(16, 185, 129)",
        bg: "rgba(16, 185, 129, 0.08)",
      },
      failed: {
        main: "rgb(239, 68, 68)",
        bg: "rgba(239, 68, 68, 0.08)",
      },
    },
  },

  shadows: {
    subtle: "0 1px 2px rgba(0, 0, 0, 0.04)",
    input: "0 2px 8px rgba(0, 0, 0, 0.08)",
    inputFocus: "0 4px 16px rgba(0, 0, 0, 0.12)",
    button: "0 1px 3px rgba(0, 0, 0, 0.08)",
    buttonHover: "0 2px 6px rgba(0, 0, 0, 0.12)",
    primary: "0 2px 6px rgba(16, 105, 151, 0.3)",
    primaryHover: "0 4px 12px rgba(16, 105, 151, 0.4)",
  },

  animations: {
    messageEntrance: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    },
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.2 },
    },
  },
} as const;

export type ChatTokens = typeof chatTokens;
