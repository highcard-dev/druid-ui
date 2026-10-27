import { generateGuestTypes } from "@bytecodealliance/jco-transpile";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const files = await generateGuestTypes("wit", {
  worldName: "openui-client",
  outDir: "generated",
});
for (const [name, bytes] of Object.entries(files)) {
  await mkdir(dirname(name), { recursive: true });
  await writeFile(name, bytes);
}
