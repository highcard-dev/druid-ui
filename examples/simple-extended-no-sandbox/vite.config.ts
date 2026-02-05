import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";
import { ViteHMRPlugin } from "@druid-ui/vite";

export default defineConfig({
  plugins: [
    topLevelAwait(),
    wasm(),
    ViteHMRPlugin("public/*.tsx", "raw", {
      worldName: "druid-ui-extended",
      files: ["src/wit/extension.wit"],
    }),
  ],
  optimizeDeps: {
    exclude: [
      "@bytecodealliance/jco",
      "@bytecodealliance/componentize-js",
      "@druid-ui/host",
      "druid:ui/extension",
    ],
  },
  server: {
    fs: {
      allow: ["../.."],
    },
  },
});
