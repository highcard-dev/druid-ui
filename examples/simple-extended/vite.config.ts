import path from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";
import { ViteHMRPlugin } from "../../src/dev/plugin";

export default defineConfig({
  plugins: [
    topLevelAwait(),
    wasm(),
    ViteHMRPlugin(["src/component/extended.tsx"], "wasm", {
      worldName: "druid-ui-extended",
      files: ["src/wit/extension.wit"],
    }),
  ],
  optimizeDeps: {
    exclude: [
      "@bytecodealliance/jco",
      "@bytecodealliance/componentize-js",
      "druid:ui/extension",
    ],
  }, // add this config
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ["../.."],
    },
  },
  resolve: {
    alias: {
      // Use absolute paths so Vite doesn't attempt relative resolution from the importing file.
      "druid:ui/extension": "",
    },
  },
});
