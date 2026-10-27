#!/usr/bin/env node
import {
  cp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  access,
} from "node:fs/promises";
import { dirname, resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "Usage: create-druid-ui <directory> [--template starter|starter-client|custom-wit] [--no-install]",
    );
    console.log(
      "All templates use Rust WASM guests. Requires Rust/Cargo and the wasm32-unknown-unknown target; React hosts remain TypeScript.",
    );
    return;
  }
  let target: string | undefined;
  let template = "starter";
  let install = true;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--template" || arg === "-t") template = args[++i] ?? "";
    else if (arg === "--no-install") install = false;
    else if (arg.startsWith("-") || target)
      throw new Error(`Unexpected argument: ${arg}`);
    else target = arg;
  }
  if (!target) throw new Error("A project directory is required. See --help.");
  if (!["starter", "starter-client", "custom-wit"].includes(template))
    throw new Error(`Unknown template: ${template}`);
  const directory = resolve(target);
  try {
    await access(directory);
    throw new Error(`Target already exists: ${directory}`);
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ))
      throw error;
  }
  const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  await mkdir(dirname(directory), { recursive: true });
  await cp(join(packageDir, "templates", template), directory, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await copyFile(join(packageDir, "AGENTS.md"), join(directory, "AGENTS.md"));
  const manifestPath = join(directory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.name = basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  if (install) {
    const result = spawnSync("npm", ["install"], {
      cwd: directory,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.error) throw result.error;
    if (result.status)
      throw new Error(
        "Dependency installation failed; run npm install in the new project.",
      );
  }
  console.log(
    `Created ${directory} with a Rust WASM guest.\nRun rustup target add wasm32-unknown-unknown once, then npm run dev in that directory.`,
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
