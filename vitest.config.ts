/// <reference types="vitest" />
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [{
    name: "wit-platform-test-import",
    // The WIT host supplies this module at runtime; tests provide its exports with vi.mock.
    resolveId(id) {
      if (id === "druid:ui/plattform") return id;
    },
  }],
  resolve: {
    alias: {
      "@druid-ui/build": fileURLToPath(
        new URL("./packages/build/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
