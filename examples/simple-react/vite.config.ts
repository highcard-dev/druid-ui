import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "reload-public",
      handleHotUpdate({ file, server }) {
        if (file.startsWith(`${server.config.root}/public/`)) {
          server.ws.send({
            type: "full-reload",
            path: "*",
          });
        }
      },
    },
  ],
  server: {
    watch: {
      // watch the public folder
      ignored: ["!**/public/**"],
    },
  },
});
