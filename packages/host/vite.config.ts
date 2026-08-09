import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "ui",
    },
    rollupOptions: {
      external: ["snabbdom"],
    },
    target: "esnext",
  },
  worker: {
    format: "es",
  },
});
