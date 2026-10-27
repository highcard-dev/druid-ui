import { defineConfig } from "vite";
import { druidUI } from "@druid-ui/build/vite";
export default defineConfig({
  plugins: [
    druidUI({
      entry: "guest/Cargo.toml",
      language: "rust",
      name: "index",
      witFiles: ["wit/extension.wit"],
      worldName: "custom-client",
    }),
  ],
});
