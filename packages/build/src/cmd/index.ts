#!/usr/bin/env node

import { buildWasm, buildRaw } from "../";
import { watch } from "chokidar";
import { resolve } from "node:path";

console.log("Druid UI Build Tool");
let args = process.argv;

let duBuildRaw = false;
let worldName = "druid-ui";
let watchMode = false;
const witFiles: string[] = [];

args = args.filter((arg) => {
  if (arg === "--raw") {
    duBuildRaw = true;
    return false;
  }
  if (arg === "--watch" || arg === "-w") {
    watchMode = true;
    return false;
  }
  if (arg.startsWith("--wit=")) {
    witFiles.push(arg.slice(6));
    return false;
  }
  if (arg.startsWith("--world-name=")) {
    worldName = arg.slice(13);
    return false;
  }
  return true;
});

const entryFile = args[2];

if (!entryFile) {
  console.error(
    "Usage: ./cli <entry-file> [out-folder] [--world-name=<name>] [--wit=<file>] [--raw] [--watch|-w]",
  );
  process.exit(1);
}

const outfolder = args[3] || "./dist";

async function doBuild() {
  console.log(`Building ${entryFile} to ${outfolder}...`);
  try {
    if (duBuildRaw) {
      await buildRaw(entryFile, outfolder);
    } else {
      await buildWasm(entryFile, outfolder, {
        worldName,
        files: witFiles,
      });
    }
    console.log("Build complete.");
  } catch (error) {
    console.error("Build failed:", error);
    process.exitCode = 1;
  }
}

await doBuild();

if (watchMode) {
  console.log("Watching for changes...");
  const srcDir = resolve(entryFile, "..");
  let building = false;
  let buildQueued = false;

  const rebuild = async () => {
    if (building) {
      buildQueued = true;
      return;
    }
    do {
      buildQueued = false;
      building = true;
      await doBuild();
      building = false;
    } while (buildQueued);
  };

  watch(srcDir, { ignoreInitial: true, usePolling: true, interval: 250 })
    .on("error", (error) => console.error("Watch failed:", error))
    .on("all", (_event, path) => {
      if (!/\.[jt]sx?$/.test(path)) return;
      console.log(`\nFile changed: ${path}`);
      void rebuild();
    });

  // Keep the process running
  await new Promise(() => {});
}
