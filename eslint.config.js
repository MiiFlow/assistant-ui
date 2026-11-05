import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// The rules of eslint-plugin-react-hooks' `recommended` config that this
// package has adopted, at the severity that config gives them: the two classic
// rules and the React Compiler family 7.x added. A rule a later minor adds is
// a warning until adopting it is its own change: the standalone mirror installs
// without a lockfile, so taking an unseen rule at error would turn its lint red
// with no change here (#2577 did exactly that for two weeks). web/ keeps the
// compiler family at warn (web/eslint.config.mjs) until it meets them too.
const ADOPTED_HOOK_RULES = new Set([
  "react-hooks/rules-of-hooks",
  "react-hooks/exhaustive-deps",
  "react-hooks/static-components",
  "react-hooks/use-memo",
  "react-hooks/preserve-manual-memoization",
  "react-hooks/incompatible-library",
  "react-hooks/immutability",
  "react-hooks/globals",
  "react-hooks/refs",
  "react-hooks/set-state-in-effect",
  "react-hooks/error-boundaries",
  "react-hooks/purity",
  "react-hooks/set-state-in-render",
  "react-hooks/unsupported-syntax",
  "react-hooks/config",
  "react-hooks/gating",
]);
const reactHooksRules = Object.fromEntries(
  Object.entries(reactHooks.configs.recommended.rules).map(([rule, level]) => [
    rule,
    // A rule upstream ships off stays off; this only lowers severities.
    ADOPTED_HOOK_RULES.has(rule) || level === "off" || level === 0
      ? level
      : "warn",
  ]),
);

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...reactHooksRules,
      // Block MUI and Emotion imports - the core prevention mechanism
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@mui/*", "@mui/**"],
              message:
                "MUI imports are forbidden in @miiflow/assistant-ui. Use headless primitives with Tailwind styling instead.",
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
