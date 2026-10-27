import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// Build sequentially: several simultaneous React/WASM builds are memory-heavy.
for (const directory of (
  await readdir("examples", { withFileTypes: true })
).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!directory.isDirectory()) continue;
  let manifest;
  try {
    manifest = JSON.parse(
      await readFile(join("examples", directory.name, "package.json"), "utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (!manifest.scripts?.build) continue;
  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build", "--workspace", manifest.name],
    { stdio: "inherit" },
  );
}
