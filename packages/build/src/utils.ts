import path from "node:path";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import { resolve, basename } from "node:path";

export function getPackageJsonPath(
  startDir: string = import.meta.dirname
): string {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    const pkgJson = path.join(dir, "package.json");
    if (fsSync.existsSync(pkgJson)) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("package.json not found");
}

export async function getWitFolder(withFiles: string[], witPath = "wit-out") {
  //create outfolder/wit
  await fs.mkdir(witPath, { recursive: true });

  const baseWitPath = getPackageJsonPath();

  const witFiles = await fs.readdir(resolve(baseWitPath, "wit"));
  for (const file of witFiles) {
    await fs.copyFile(
      resolve(baseWitPath, "wit", file),
      resolve(witPath, file)
    );
  }
  for (const file of withFiles || []) {
    const filename = basename(file);
    await fs.copyFile(file, resolve(witPath, filename));
  }
}
