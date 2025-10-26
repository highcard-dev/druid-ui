import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const isStandalone = mode === "standalone";

  return {
    build: {
      lib: {
        entry: resolve(__dirname, "src/main.ts"),
        name: "DruidUI",
        fileName: (format) => {
          const suffix = isStandalone ? "standalone" : "lib";
          return `druid-ui.${suffix}.${format === "es" ? "esm" : format}.js`;
        },
        formats: ["es", "umd"],
      },
      rollupOptions: {
        // External dependencies only for library build
        external: isStandalone ? [] : ["wasmoon"],
        output: {
          globals: isStandalone
            ? undefined
            : {
                wasmoon: "wasmoon",
                morphdom: "morphdom",
              },
        },
      },
      sourcemap: true,
      emptyOutDir: false, // Don't empty on each build so we can build both
      chunkSizeWarningLimit: 1000,
    },
  };
});
