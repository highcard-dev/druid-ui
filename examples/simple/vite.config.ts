import path from "path";
import { fileURLToPath } from "url";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";
import { ViteHMRPlugin } from "@druid-ui/vite";

export default defineConfig({
  plugins: [topLevelAwait(), wasm(), ViteHMRPlugin("src/component/**")],
  optimizeDeps: {
    exclude: [
      "@bytecodealliance/jco",
      "@bytecodealliance/componentize-js",
      "@druid-ui/host",
    ],
  },
  server: {
    fs: {
      allow: ["../.."],
    },
  },
});
