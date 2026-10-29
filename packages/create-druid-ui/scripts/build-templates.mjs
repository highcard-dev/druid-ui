import { cp, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, join } from "node:path";
const directory = fileURLToPath(new URL("../", import.meta.url));
await rm(join(directory, "templates"), { recursive: true, force: true });
const version = JSON.parse(
  await readFile(join(directory, "package.json"), "utf8"),
).version;
for (const name of ["starter", "starter-client", "custom-wit"]) {
  const example = name === "starter-client" ? "starter-component" : name;
  const source = fileURLToPath(
    new URL(`../../../examples/${example}/`, import.meta.url),
  );
  await cp(source, join(directory, "templates", name), {
    recursive: true,
    filter: (file) =>
      !/\.test\.[cm]?[jt]sx?$/.test(file) &&
      (![
        "node_modules",
        "dist",
        "generated",
        "target",
        "client",
        "scripts",
        ".turbo",
      ].includes(basename(file)) ||
        file.endsWith("src/client")),
  });
  const manifestPath = join(directory, "templates", name, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  delete manifest.scripts["test:assets"];
  for (const section of ["dependencies", "devDependencies"])
    for (const pkg of Object.keys(manifest[section] ?? {}))
      if (pkg.startsWith("@druid-ui/")) manifest[section][pkg] = version;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  if (name !== "custom-wit") {
    const client = fileURLToPath(new URL("../../client/", import.meta.url));
    await copyFile(join(client, "build-rust.sh"), join(directory, "templates", name, "build.sh"));
    await cp(join(client, "wit"), join(directory, "templates", name, "wit"), { recursive: true });
  }
}
await copyFile(join(directory, "src/AGENTS.md"), join(directory, "AGENTS.md"));
