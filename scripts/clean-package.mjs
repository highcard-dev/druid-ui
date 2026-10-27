import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (
  ![
    "@druid-ui/client",
    "@druid-ui/host",
    "@druid-ui/build",
    "create-druid-ui",
  ].includes(pkg.name)
)
  throw new Error("Run only in a known SDK package");
for (const output of [
  "dist",
  ...(pkg.bin ? ["bin"] : []),
  ...(pkg.name === "@druid-ui/client" ? ["generated"] : []),
]) {
  await rm(resolve(output), { recursive: true, force: true });
}
