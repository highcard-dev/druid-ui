import type { Plugin } from "esbuild";

export function druidExtensionPlugin(): Plugin {
  return {
    name: "druid-extension",
    setup(build) {
      // Intercept all druid:ui/* imports at the resolution level.
      // This is much more robust than regex-replacing file content,
      // because it doesn't depend on reading source files from disk.
      build.onResolve({ filter: /^druid:ui\// }, (args) => ({
        path: args.path,
        namespace: "druid-ext",
      }));

      // Provide a virtual CJS module that re-exports everything from
      // window["druid-extension"]["<module-path>"].
      // esbuild handles the CJS→ESM interop automatically, so
      // `import { d } from "druid:ui/ui"` correctly maps to
      // `window["druid-extension"]["druid:ui/ui"].d`.
      build.onLoad({ filter: /.*/, namespace: "druid-ext" }, (args) => ({
        contents: `module.exports = window["druid-extension"]["${args.path}"];`,
        loader: "js",
      }));
    },
  };
}
