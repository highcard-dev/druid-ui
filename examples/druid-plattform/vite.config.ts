import path from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";
import { ViteHMRPlugin } from "../../src/dev/plugin";

export default defineConfig({
  plugins: [
    topLevelAwait(),
    wasm(),
    ViteHMRPlugin(["src/component/druid.tsx"], "wasm", {
      worldName: "druid-plattform",
      files: ["../../src/plattform/wit/druid-plattform.wit"],
    }),
  ],
  optimizeDeps: {
    exclude: ["@bytecodealliance/jco", "@bytecodealliance/componentize-js"],
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
      "druid:ui/ui": path.resolve(__dirname, "../../src/ui.ts"),
    },
  },
});
