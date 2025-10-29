import { componentize } from "@bytecodealliance/componentize-js";
import { build } from "esbuild";
import { basename } from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";

export async function buildWasm(
  entryFile: string,
  outfolder: string = "./dist"
) {
  const name = basename(entryFile, ".tsx");

  const outfilename = name + ".js";

  const outfile = outfolder + "/" + outfilename;

  await fs.mkdir(outfolder, { recursive: true });

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

  await fs.writeFile(outfolder + "/" + name + ".wasm", result.component);
}
