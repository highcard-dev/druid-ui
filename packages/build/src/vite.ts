import { resolve, extname } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { buildWasm, type BuildOptions } from "./index";

export function druidUI(options: BuildOptions): Plugin {
  let root = process.cwd();
  let server: ViteDevServer | undefined;
  let dependencies = new Set<string>();
  let running: Promise<void> | undefined;
  let queued = false;
  const rebuild = (): Promise<void> => {
    queued = true;
    if (running) return running;
    running = (async () => {
      do {
        queued = false;
        try {
          const result = await buildWasm({
            ...options,
            entry: resolve(root, options.entry),
            document: options.document
              ? resolve(root, options.document)
              : undefined,
            outDir: resolve(root, options.outDir ?? "public/client"),
            witFiles: options.witFiles?.map((file) => resolve(root, file)),
          });
          dependencies = new Set(result.dependencies);
          for (const file of dependencies) server?.watcher.add(file);
          if (server) server.ws.send({ type: "full-reload" });
        } catch (error) {
          if (!server) throw error;
          server.ws.send({
            type: "error",
            err: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? (error.stack ?? "") : "",
            },
          });
        }
      } while (queued);
    })().finally(() => {
      running = undefined;
    });
    return running;
  };
  return {
    name: "druid-openui",
    config: () => ({
      optimizeDeps: {
        exclude: [
          "@bytecodealliance/jco-transpile/component",
          "@druid-ui/host",
        ],
      },
      worker: { format: "es" },
      ...(options.language === "rust"
        ? { server: { watch: { ignored: ["**/target/**"] } } }
        : {}),
    }),
    configResolved(config) {
      root = config.root;
      dependencies = new Set([
        resolve(root, options.entry),
        ...(options.witFiles ?? []).map((file) => resolve(root, file)),
      ]);
    },
    async configureServer(instance) {
      server = instance;
      await rebuild();
    },
    async buildStart() {
      if (!server) await rebuild();
    },
    async handleHotUpdate(context) {
      const file = resolve(context.file);
      if (options.language === "rust" && /[/\\]target[/\\]/.test(file)) return;
      if (
        dependencies.has(file) ||
        (file.startsWith(resolve(root, options.entry, "..") + "/") &&
          (options.language === "rust"
            ? [".rs", ".toml", ".lock", ".wit"]
            : [".ts", ".js", ".wit"]
          ).includes(extname(file)))
      ) {
        await rebuild();
        return [];
      }
    },
  };
}
