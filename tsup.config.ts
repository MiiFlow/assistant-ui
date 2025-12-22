import { defineConfig } from "tsup";
import type { Plugin } from "esbuild";

// Plugin to detect and block MUI/Emotion imports at build time
const noMuiPlugin: Plugin = {
  name: "no-mui",
  setup(build) {
    // Block @mui imports
    build.onResolve({ filter: /^@mui/ }, (args) => {
      throw new Error(
        `MUI import detected: "${args.path}" in ${args.importer}\n` +
          "This package must not depend on MUI. Use Tailwind CSS instead."
      );
    });

    // Block @emotion imports
    build.onResolve({ filter: /^@emotion/ }, (args) => {
      throw new Error(
        `Emotion import detected: "${args.path}" in ${args.importer}\n` +
          "This package must not depend on Emotion. Use Tailwind CSS instead."
      );
    });
  },
};

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "primitives/index": "src/primitives/index.ts",
    "styled/index": "src/styled/index.ts",
    "hooks/index": "src/hooks/index.ts",
    "context/index": "src/context/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  treeshake: true,
  minify: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  esbuildPlugins: [noMuiPlugin],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
