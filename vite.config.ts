import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  return {
    build: {
      lib: {
        entry: { ui: resolve(__dirname, "src/ui.ts") },
        name: "DruidUI",
        formats: ["es", "umd"],
      },
      sourcemap: true,
      emptyOutDir: false, // Don't empty on each build so we can build both
      chunkSizeWarningLimit: 1000,
    },
  };
});
