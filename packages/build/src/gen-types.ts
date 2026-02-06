import { generateTypes } from "@bytecodealliance/jco/component";
import { mkdir, rm, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { getWitFolder } from "./utils";

export async function genTypes(
  withFiles: string[],
  worldName = "druid-ui",
  typePath = "types",
  witPath = "wit-out"
) {
  await getWitFolder(withFiles, witPath);
  const t = await generateTypes(worldName, {
    wit: {
      tag: "path",
      val: resolve(witPath),
    },
    world: worldName,
    instantiation: {
      tag: "async",
    },
    guest: true,
  });

  for (const [filename, contents] of t) {
    console.log("Writing generated type:", typePath + "/" + filename);
    await mkdir(resolve(typePath, dirname(filename)), { recursive: true });
    await writeFile(resolve(typePath, filename), contents);
  }
  await rm(witPath, { recursive: true });
}
