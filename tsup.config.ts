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
    "client/index": "src/client/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  treeshake: true,
  minify: true,
  sourcemap: true,
  // Externalize everything that uses React or is a heavy dependency.
  // Consumers must install these (listed in peerDependencies or dependencies).
  external: [
    "react",
    "react-dom",
    "framer-motion",
    "lucide-react",
    "react-markdown",
    "remark-gfm",
    "recharts",
    "react-syntax-highlighter",
    /^react-syntax-highlighter\//,
    // lexical and @lexical/* are NOT externalized — they are bundled to avoid
    // version conflicts when consumers use a different Lexical version.
    "clsx",
    "tailwind-merge",
  ],
  esbuildPlugins: [noMuiPlugin],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
