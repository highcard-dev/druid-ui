import { type PluginOption, type ViteDevServer } from "vite";
import { buildWasm, buildRaw } from "../../bin/build";

// Simple monotonic version to use as a cache-busting query param for rebuilt wasm.
// Incremented after each successful rebuild.
export function ViteHMRPlugin(
  components: string[],
  buildType: "wasm" | "raw" = "wasm"
): PluginOption {
  let wasmVersion = Date.now();

  async function rebuildAll(server: ViteDevServer, reason: string) {
    console.log(`[${buildType}] Rebuilding (${reason})…`);
    const start = Date.now();
    // Build all components in parallel and await completion to avoid partial writes.
    await Promise.all(
      components.map(async (comp) => {
        if (buildType === "raw") return await buildRaw(comp, "public");
        await buildWasm(comp, "public");
        console.log(`[wasm] Build complete for '${comp}'`);
      })
    );
    wasmVersion = Date.now(); // bump version
    const duration = Date.now() - start;
    console.log(
      `[${buildType}] Rebuild finished in ${duration}ms. New version: ${wasmVersion}`
    );
    // Notify clients so they can refetch with cache-busting query (?v=wasmVersion)
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
      // Dev middleware: disable caching for wasm so stale content isn't reused.
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
