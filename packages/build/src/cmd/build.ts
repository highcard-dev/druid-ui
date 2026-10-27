#!/usr/bin/env node
import { watch } from "chokidar";
import { dirname, resolve } from "node:path";
import { buildWasm } from "../index";
import { parseOptions } from "./options";
try {
  const options = parseOptions(process.argv.slice(2));
  let running = false;
  let queued = false;
  const watcher = options.watch
    ? watch([dirname(resolve(options.entry)), ...options.witFiles!], {
        ignoreInitial: true,
        ignored: /(^|[/\\])(target|node_modules|\.git)([/\\]|$)/,
      })
    : undefined;
  const rebuild = async () => {
    queued = true;
    if (running) return;
    running = true;
    do {
      queued = false;
      try {
        const result = await buildWasm(options);
        watcher?.add(result.dependencies);
        console.log(`Built ${result.file}`);
      } catch (error) {
        if (!watcher) throw error;
        console.error(error);
      }
    } while (queued);
    running = false;
  };
  watcher?.on("all", () => {
    void rebuild();
  });
  await rebuild();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
