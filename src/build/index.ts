// @ts-nocheck
import { componentize } from "@bytecodealliance/componentize-js";
import { build } from "esbuild";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, basename } from "node:path";
import { getPackageJsonPath, getWitFolder } from "./utils";
import { druidExtensionPlugin } from "./esbuild-plugin";

export interface WitExtension {
  worldName: string;
  files: string[];
}

const getBundleFileName = (entryFile) => {
  const name = basename(entryFile, ".tsx");

  const outfilename = name + ".bundled.js";
  return outfilename;
};

export async function buildWasm(
  entryFile,
  outfolder = "./dist",
  witExtension?: WitExtension
) {
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
    external: ["druid:ui/*"],
  });

  const __filename = fileURLToPath(import.meta.url);

  let witDist = outfolder + "/wit";

  //if we want to extend, we need to copy the wit files into a unified folder
  if (witExtension?.files?.length) {
    await getWitFolder(witExtension.files, witDist);
  } else {
    witDist = getPackageJsonPath() + "/wit";
  }

  console.log("Generating WIT to", witDist);
  const result = await componentize({
    witPath: witDist,
    worldName: witExtension?.worldName || "druid-ui",
    sourcePath: outfile,
    disableFeatures: ["clocks", "http", "random", "stdio", "fetch-event"],
  });

  const name = basename(entryFile, ".tsx");
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
    plugins: [druidExtensionPlugin()],
    alias: {
      "druid-ui/component": getPackageJsonPath() + "/src/component/raw.ts",
    },
  });
}

export * from "./gen-types";
