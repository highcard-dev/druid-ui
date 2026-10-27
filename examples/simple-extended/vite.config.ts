import { defineConfig } from "vite";
import { druidUI } from "@druid-ui/build/vite";
export default defineConfig({
  plugins: [druidUI({ entry: "src/client/index.ts" })],
});
