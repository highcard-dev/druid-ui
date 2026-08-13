import path from "path";
import { fileURLToPath } from "url";
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vite";
import { ViteHMRPlugin } from "@druid-ui/vite";

export default defineConfig({
  plugins: [wasm(), ViteHMRPlugin("src/component/**")],
  build: {
    target: "esnext",
  },
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
