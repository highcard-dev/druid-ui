import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout } from "node:timers/promises";
import { buildWasm } from "@druid-ui/build";

assert.equal(
  typeof WebAssembly.Suspending,
  "function",
  "Use a JSPI-capable Node.js24+ runtime",
);
// Resolve the production host's pin, not the build package's independent version.
// Optional module path permits an explicit old-release red/green control run.
const hostRequire = createRequire(
  new URL("../packages/host/package.json", import.meta.url),
);
const transpiler = process.argv[2]
  ? resolve(process.argv[2])
  : hostRequire.resolve("@bytecodealliance/jco-transpile/component");
const { generate, $init } = await import(pathToFileURL(transpiler).href);
process.env.CARGO_TARGET_DIR ??= resolve(
  ".verification/async-host-imports/target",
);
const built = await buildWasm({
  entry: "tests/fixtures/async-host-imports/Cargo.toml",
  language: "rust",
  outDir: ".verification/async-host-imports",
  name: "client",
  witFiles: ["tests/fixtures/async-host-imports/world.wit"],
  worldName: "async-host-imports",
});
await $init;
const { files } = generate(await readFile(built.file), {
  name: "client",
  instantiation: { tag: "async" },
  noTypescript: true,
  noNodejsCompat: true,
  base64Cutoff: 0,
});
const assets = new Map(files);
const { instantiate } = await import(
  `data:text/javascript;base64,${Buffer.from(assets.get("client.js")).toString("base64")}`
);
for (const mode of ["sync", "promise", "delayed"]) {
  const calls = [];
  const instance = await instantiate(
    (name) => WebAssembly.compile(assets.get(name)),
    {
      "druid:openui/host": {
        log() {},
        call() {
          throw "Unexpected host tool";
        },
      },
      "druid:openui/state": { getValue() {}, setValue() {} },
      "druid:openui/webgpu": {
        readBuffer(buffer, offset, size) {
          assert.equal(offset, 0);
          assert.equal(size, 4);
          calls.push(buffer);
          const bytes = Uint8Array.of(buffer + 1, 0, 0, 0);
          if (mode === "sync") return bytes;
          if (mode === "promise") return Promise.resolve(bytes);
          return setTimeout(buffer === 10 ? 10 : 1).then(() => bytes);
        },
      },
    },
  );
  await instance.client.init();
  // No promising wrapper: canonical async lowering must return status now,
  // even when its actual host result remains pending.
  const statuses = instance.startTwo();
  assert.equal(statuses instanceof Promise, false);
  assert.deepEqual(
    calls,
    [10, 20],
    "Both host imports start in the caller's current slice",
  );
  if (mode === "sync") assert.deepEqual(Array.from(statuses), [2, 2]);
  else {
    assert.deepEqual(
      Array.from(statuses, (value) => value & 0xf),
      [1, 1],
    );
    assert.notEqual(statuses[0] >>> 4, statuses[1] >>> 4);
  }
  for (
    let attempt = 0;
    attempt < 100 && instance.results().some((value) => value === 0);
    attempt++
  )
    await setTimeout(10);
  assert.deepEqual(Array.from(instance.results()), [11, 21]);
  console.log(`PASS real Rust canonical async host ordering: ${mode}`);
}
