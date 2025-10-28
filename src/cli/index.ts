import { componentize } from "@bytecodealliance/componentize-js";
import { build } from "esbuild";
import { basename } from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

const entryFile = process.argv[2];

if (!entryFile) {
  console.error("Usage: ts-node src/cli/index.ts <entry-file> [out-folder]");
  process.exit(1);
}

const name = basename(entryFile, ".tsx");

const outfilename = name + ".js";

const outfolder = process.argv[3] || "./dist";
const outfile = outfolder + "/" + outfilename;

fs.mkdir(outfolder, { recursive: true });

await build({
  entryPoints: [entryFile],
  bundle: true,
  write: true,
  format: "esm", // you can also use 'iife' or 'cjs'
  outfile: outfile,
  external: ["druid:ui/ui", "druid:ui/initcomponent", "druid:ui/utils"],
});

const __filename = fileURLToPath(import.meta.url);

const result = await componentize({
  witPath: dirname(__filename) + "/../../wit",
  worldName: "druid-ui",
  sourcePath: outfile,
  disableFeatures: ["clocks", "http", "random", "stdio", "fetch-event"],
});

fs.writeFile(outfolder + "/" + name + ".wasm", result.component);
