/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Block MUI and Emotion imports - the core prevention mechanism
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@mui/*", "@mui/**"],
              message:
                "MUI imports are forbidden in @miiflow/chat-ui. Use headless primitives with Tailwind styling instead.",
            },
            {
              group: ["@emotion/*", "@emotion/**"],
              message:
                "Emotion imports are forbidden. Use Tailwind CSS instead.",
            },
          ],
        },
      ],
    },
  },
];
