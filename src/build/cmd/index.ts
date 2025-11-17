#!/usr/bin/env node

import { buildWasm, buildRaw } from "../";
console.log("Druid UI Build Tool");
let args = process.argv;

let duBuildRaw = false;
const witFiles: string[] = [];

args = args.filter((arg) => {
  if (arg === "--raw") {
    duBuildRaw = true;
    return false;
  }
  if (arg.startsWith("--wit=")) {
    witFiles.push(arg.slice(6));
    return false;
  }
  return true;
});

const entryFile = args[2];

if (!entryFile) {
  console.error("Usage: ./cli <entry-file> [out-folder]");
  process.exit(1);
}

const outfolder = args[3] || "./dist";
console.log(`Building ${entryFile} to ${outfolder}...`);
if (duBuildRaw) {
  await buildRaw(entryFile, outfolder);
} else {
  await buildWasm(entryFile, outfolder, {
    worldName: "druid-ui",
    files: witFiles,
  });
}

console.log("Build complete.");
