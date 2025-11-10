// src/build/gen-types.ts
import { generateTypes } from "@bytecodealliance/jco/component";
import { mkdir, rmdir, writeFile } from "fs/promises";
import fs2 from "fs/promises";
import { basename, dirname, resolve } from "path";

// src/build/utils.ts
import path from "node:path";
import fs from "node:fs";
function getPackageJsonPath(startDir = import.meta.dirname) {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    const pkgJson = path.join(dir, "package.json");
    if (fs.existsSync(pkgJson)) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("package.json not found");
}

// src/build/gen-types.ts
async function genTypes(withFiles, worldName = "druid-ui", typePath2 = "types", witPath = "wit-out") {
  await fs2.mkdir(witPath, { recursive: true });
  const baseWitPath = getPackageJsonPath();
  const witFiles = await fs2.readdir(resolve(baseWitPath, "wit"));
  for (const file of witFiles) {
    await fs2.copyFile(
      resolve(baseWitPath, "wit", file),
      resolve(witPath, file)
    );
  }
  for (const file of withFiles || []) {
    const filename = basename(file);
    await fs2.copyFile(file, resolve(witPath, filename));
  }
  const t = await generateTypes(worldName, {
    wit: {
      tag: "path",
      val: resolve(witPath)
    },
    world: worldName,
    instantiation: {
      tag: "async"
    },
    guest: true
  });
  for (const [filename, contents] of t) {
    console.log("Writing generated type:", typePath2 + "/" + filename);
    await mkdir(resolve(typePath2, dirname(filename)), { recursive: true });
    await writeFile(resolve(typePath2, filename), contents);
  }
  await rmdir(witPath, { recursive: true });
}

// src/build/cmd/gen-types.ts
var args = process.argv.slice(2);
if (args.length < 2) {
  console.error(
    "Usage: ts-node src/build/cmd/gen-types.ts <wit-path> <world-name> [additional-wit-files...]"
  );
  process.exit(1);
}
var typePath = args[0];
var additionalFiles = args.slice(1);
await genTypes(additionalFiles, typePath);
