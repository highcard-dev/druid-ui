import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [
    {
      name: "wit-test-imports",
      resolveId(id) {
        if (["druid:openui/host", "druid:openui/state"].includes(id)) return id;
      },
    },
  ],
  resolve: {
    alias: {
      "@druid-ui/host": fileURLToPath(
        new URL("./packages/host/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/templates/**",
      ".verification/**",
    ],
  },
});
