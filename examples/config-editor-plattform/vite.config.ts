import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";
import { ViteHMRPlugin } from "@druid-ui/vite";

export default defineConfig({
  plugins: [
    topLevelAwait(),
    wasm(),
    ViteHMRPlugin("src/app.tsx", "raw", undefined, [
      "../../packages/config-editor/src/**/*.{ts,tsx}",
    ]),
  ],
  build: { target: "esnext" },
  optimizeDeps: {
    exclude: [
      "@bytecodealliance/jco",
      "@bytecodealliance/componentize-js",
      "@druid-ui/host",
    ],
  },
  server: {
    fs: { allow: ["../.."] },
    watch: { usePolling: true, interval: 150 },
  },
});
