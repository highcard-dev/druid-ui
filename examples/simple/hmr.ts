import { PluginOption } from "vite";
import { buildWasm } from "../../bin/build";

export default function I18nHotReload(): PluginOption {
  return {
    name: "i18n-hot-reload",
    async handleHotUpdate({ file, server }) {
      if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        //TODO: find a way to make this dynamic
        console.log("Rebuilding WASM for file change:", file);
        await buildWasm("src/component/adder.tsx", "public");
        await new Promise((resolve) => setTimeout(resolve, 100)); //wait a bit to ensure file is written
        server.ws.send({
          type: "custom",
          event: "ui-update",
          data: { file },
        });
      }
    },
    async configureServer(server) {
      console.log("Building initial WASM...");
      await buildWasm("src/component/adder.tsx", "public");
      console.log("Initial WASM build complete.");
    },
  };
}
