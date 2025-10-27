import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [topLevelAwait(), wasm()],
  optimizeDeps: {
    exclude: ["@bytecodealliance/jco"],
  }, // add this config
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ["../.."],
    },
  },
});
