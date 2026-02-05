import path from "path";
import { fileURLToPath } from "url";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";
import { ViteHMRPlugin } from "@druid-ui/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plattformPkgDir = path.resolve(__dirname, "../../packages/plattform");

export default defineConfig({
  plugins: [
    topLevelAwait(),
    wasm(),
    ViteHMRPlugin("src/component/**", "raw", {
      worldName: "druid-plattform",
      files: [path.resolve(plattformPkgDir, "wit/druid-plattform.wit")],
    }),
  ],
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
