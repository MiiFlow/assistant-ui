/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // CSS variable-based colors for easy theming
        primary: "var(--chat-primary, #106997)",
        secondary: "var(--chat-secondary, #56C18A)",
        error: "var(--chat-error, #B1001B)",
        warning: "var(--chat-warning, #DD9652)",
        "chat-text": "var(--chat-text, #1D2033)",
        "chat-subtle": "var(--chat-text-subtle, rgba(0, 0, 0, 0.5))",
        "chat-border": "var(--chat-border, rgba(0, 0, 0, 0.06))",
        "chat-border-hover": "var(--chat-border-hover, rgba(0, 0, 0, 0.12))",
        "chat-message-bg": "var(--chat-message-bg, rgba(0, 0, 0, 0.03))",
        "chat-user-bg": "var(--chat-user-message-bg, var(--chat-primary, #106997))",
        "chat-panel-bg": "var(--chat-panel-bg, rgba(0, 0, 0, 0.02))",
      },
      fontFamily: {
        sans: ["var(--chat-font-family)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        message: "var(--chat-radius-message, 0.5rem)",
        input: "var(--chat-radius-input, 1rem)",
        panel: "var(--chat-radius-panel, 0.5rem)",
        button: "var(--chat-radius-button, 0.5rem)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-subtle": "pulseSubtle 2s infinite",
        typing: "typing 1.4s infinite ease-in-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        typing: {
          "0%, 60%, 100%": { opacity: "0.3", transform: "scale(0.8)" },
          "30%": { opacity: "1", transform: "scale(1)" },
        },
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(0, 0, 0, 0.04)",
        input: "0 2px 8px rgba(0, 0, 0, 0.08)",
        "input-focus": "0 4px 16px rgba(0, 0, 0, 0.12)",
        button: "0 1px 3px rgba(0, 0, 0, 0.08)",
        "button-hover": "0 2px 6px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};
