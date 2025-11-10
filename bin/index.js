#!/usr/bin/env node

// src/build/index.ts
import { componentize } from "@bytecodealliance/componentize-js";
import { build } from "esbuild";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, basename } from "node:path";

// src/build/gen-types.ts
import { generateTypes } from "@bytecodealliance/jco/component";

// src/build/index.ts
var getBundleFileName = (entryFile2) => {
  const name = basename(entryFile2, ".tsx");
  const outfilename = name + ".bundled.js";
  return outfilename;
};
async function buildWasm(entryFile2, outfolder2 = "./dist", witExtension) {
  await fs.mkdir(outfolder2, { recursive: true });
  const outfilename = getBundleFileName(entryFile2);
  const outfile = outfolder2 + "/" + outfilename;
  console.log("Building", entryFile2, "to", outfile);
  await build({
    entryPoints: [entryFile2],
    bundle: true,
    write: true,
    format: "esm",
    outfile,
    external: ["druid:ui/ui", "druid:ui/initcomponent", "druid:ui/utils"]
  });
  const __filename2 = fileURLToPath(import.meta.url);
  const witDist = outfolder2 + "/wit";
  const result = await componentize({
    witPath: witDist,
    worldName: witExtension.worldName || "druid-ui",
    sourcePath: outfile,
    disableFeatures: ["clocks", "http", "random", "stdio", "fetch-event"]
  });
  const name = basename(entryFile2, ".tsx");
  await fs.writeFile(outfolder2 + "/" + name + ".wasm", result.component);
}
async function buildRaw(entryFile2, outfolder2 = "./dist") {
  const outfilename = getBundleFileName(entryFile2);
  const outfile = outfolder2 + "/" + outfilename;
  const __filename2 = fileURLToPath(import.meta.url);
  await build({
    entryPoints: [entryFile2],
    bundle: true,
    write: true,
    format: "esm",
    outfile,
    alias: {
      "druid-ui/component": dirname(__filename2) + "/../src/component/raw.ts"
    }
  });
}

// src/build/cmd/index.ts
var args = process.argv;
var duBuildRaw = false;
var witFiles = [];
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
var entryFile = args[2];
if (!entryFile) {
  console.error("Usage: ts-node src/cli/index.ts <entry-file> [out-folder]");
  process.exit(1);
}
var outfolder = args[3] || "./dist";
if (duBuildRaw) {
  buildRaw(entryFile, outfolder);
} else {
  buildWasm(entryFile, outfolder, {
    files: witFiles,
    worldName: "druid-ui"
  });
}
