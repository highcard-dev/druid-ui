#!/usr/bin/env node

import { buildWasm, buildRaw } from "../dist/ui.js";

let args = process.argv;

let duBuildRaw = false;

args = args.filter((arg) => {
  if (arg === "--raw") {
    duBuildRaw = true;
  }
  return arg === "--raw";
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
  buildWasm(entryFile, outfolder);
}
