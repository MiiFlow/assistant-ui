import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// eslint-plugin-react-hooks 7 folded the React Compiler rule family into
// `recommended` at error level. This package does not build with the React
// Compiler and has ~50 unmet sites, so taking those severities verbatim would
// adopt a new standard under cover of a dependency bump (#2577 did exactly
// that and the mirror's lint failed for two weeks). The two classic rules keep
// their severities; every other recommended rule is a warning until adopting
// them is its own change. web/ makes the same call in web/eslint.config.mjs
// with an explicit list; this one is computed because the mirror installs
// without a lockfile, so a newer minor that adds a rule at error would
// otherwise turn its lint red again with no change here.
const CLASSIC_HOOK_RULES = new Set([
  "react-hooks/rules-of-hooks",
  "react-hooks/exhaustive-deps",
]);
const reactHooksRules = Object.fromEntries(
  Object.entries(reactHooks.configs.recommended.rules).map(([rule, level]) => [
    rule,
    // A rule upstream ships off stays off; this only lowers severities.
    CLASSIC_HOOK_RULES.has(rule) || level === "off" || level === 0
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
