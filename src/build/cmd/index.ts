#!/usr/bin/env node

import { buildWasm, buildRaw } from "../";

let args = process.argv;

let duBuildRaw = false;
const witFiles: string[] = [];

args = args.filter((arg) => {
  if (arg === "--raw") {
    duBuildRaw = true;
    return true;
  }
  if (arg.startsWith("--wit=")) {
    witFiles.push(arg.slice(6));
    return true;
  }
  return false;
});

const entryFile = args[2];

if (!entryFile) {
  console.error("Usage: ts-node src/cli/index.ts <entry-file> [out-folder]");
  process.exit(1);
}

const outfolder = args[3] || "./dist";

if (duBuildRaw) {
  buildRaw(entryFile, outfolder);
} else {
  buildWasm(entryFile, outfolder, {
    worldName: "druid-ui",
    files: witFiles,
  });
}
