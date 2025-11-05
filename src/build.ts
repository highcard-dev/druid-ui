// @ts-nocheck
import { componentize } from "@bytecodealliance/componentize-js";
import { build } from "esbuild";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, basename } from "node:path";

const getBundleFileName = (entryFile) => {
  console.log("Entry file:", entryFile);
  const name = basename(entryFile, ".tsx");

  const outfilename = name + ".bundled.js";
  return outfilename;
};

export async function buildWasm(entryFile, outfolder = "./dist") {
  await fs.mkdir(outfolder, { recursive: true });

  const outfilename = getBundleFileName(entryFile);

  const outfile = outfolder + "/" + outfilename;
  console.log("Building", entryFile, "to", outfile);
  await build({
    entryPoints: [entryFile],
    bundle: true,
    write: true,
    format: "esm",
    outfile: outfile,
    external: ["druid:ui/ui", "druid:ui/initcomponent", "druid:ui/utils"],
  });

  const __filename = fileURLToPath(import.meta.url);

  const result = await componentize({
    witPath: dirname(__filename) + "/../wit",
    worldName: "druid-ui",
    sourcePath: outfile,
    disableFeatures: ["clocks", "http", "random", "stdio", "fetch-event"],
  });

  await fs.writeFile(outfolder + "/" + name + ".wasm", result.component);
}

export async function buildRaw(entryFile, outfolder = "./dist") {
  const outfilename = getBundleFileName(entryFile);

  const outfile = outfolder + "/" + outfilename;

  const __filename = fileURLToPath(import.meta.url);
  await build({
    entryPoints: [entryFile],
    bundle: true,
    write: true,
    format: "esm",
    outfile: outfile,
    alias: {
      "druid-ui/component": dirname(__filename) + "/../src/component/raw.ts",
    },
  });
}
