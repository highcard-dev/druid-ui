#!/usr/bin/env node

import { buildWasm } from "./build.js";

let args = process.argv;

let buildRaw = false;

args = args.filter((arg) => {
  if (arg === "--raw") {
    buildRaw = true;
  }
  return arg === "--raw";
});

const entryFile = args[2];

if (!entryFile) {
  console.error("Usage: ts-node src/cli/index.ts <entry-file> [out-folder]");
  process.exit(1);
}

const outfolder = args[3] || "./dist";

if (buildRaw) {
  buildRaw(entryFile, outfolder);
} else {
  buildWasm(entryFile, outfolder);
}
