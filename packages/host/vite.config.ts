import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "@openuidev/react-lang",
      ],
    },
  },
  worker: { format: "es" },
});
