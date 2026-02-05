import { type PluginOption, type ViteDevServer } from "vite";
import { buildWasm, buildRaw, type WitExtension } from "@druid-ui/build";
import { glob } from "tinyglobby";

export function ViteHMRPlugin(
  pattern: string,
  buildType: "wasm" | "raw" = "wasm",
  ext?: WitExtension
): PluginOption {
  let wasmVersion = Date.now();

  async function rebuildAll(server: ViteDevServer, reason: string) {
    const components = await glob(pattern);
    console.log(`[${buildType}] Rebuilding (${reason})…`);
    const start = Date.now();

    await Promise.all(
      components.map(async (comp) => {
        if (buildType === "raw") return await buildRaw(comp, "public");
        await buildWasm(comp, "public", ext);
        console.log(`[wasm] Build complete for '${comp}'`);
      })
    );
    wasmVersion = Date.now();
    const duration = Date.now() - start;
    console.log(
      `[${buildType}] Rebuild finished in ${duration}ms. New version: ${wasmVersion}`
    );
    server.ws.send({
      type: "custom",
      event: "ui-update",
      data: { version: wasmVersion, reason },
    });
  }

  return {
    name: "vite-hmr",
    async handleHotUpdate({ file, server }) {
      if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        await rebuildAll(server, `change:${file}`);
      }
    },
    async configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.endsWith(".wasm")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
        next();
      });
      await rebuildAll(server, "initial");
    },
  };
}
