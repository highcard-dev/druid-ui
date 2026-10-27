// @vitest-environment node
import { expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { generate, $init } from "@bytecodealliance/jco-transpile/component";
import { buildWasm } from "./index";
import { createToolSession } from "../../host/src/tools";
import type { ClientExports } from "@druid-ui/client/types";

it("compiles a custom-world guest and runs typed imports, async calls and JSON state through real WASM", async () => {
  await mkdir(".verification", { recursive: true });
  const outDir = await mkdtemp(resolve(".verification/wasm-"));
  const result = await buildWasm({
    entry: "packages/build/test/guest.ts",
    outDir,
    witFiles: ["examples/custom-wit/wit/extension.wit"],
    worldName: "custom-client",
  });
  await $init;
  const generated = generate(await readFile(result.file), {
    name: "client",
    instantiation: { tag: "async" },
    noTypescript: true,
    noNodejsCompat: true,
    base64Cutoff: 0,
  });
  const files = new Map(generated.files);
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(files.get("client.js")!).toString("base64")}`
  );
  const state = new Map<string, string>([
    ["$input", '{"nested":[1,true,null]}'],
  ]);
  const controller = new AbortController();
  const pending = new Map<string, (value: string) => void>();
  const session = createToolSession(controller.signal, () => ({
    deferred: (params) =>
      new Promise<string>((resolve) => {
        pending.set(String(params.target), resolve);
      }),
    fail: () => {
      throw new Error("Tool failed");
    },
  }));
  const { client }: { client: ClientExports } = await module.instantiate(
    async (name: string) =>
      WebAssembly.compile(new Uint8Array(files.get(name)!)),
    {
      "example:custom/extension": { greet: (name: string) => `Hello ${name}` },
      "druid:openui/host": { log: console.info, call: session.call },
      "druid:openui/state": {
        getValue: (name: string) => state.get(name),
        setValue: (name: string, json: string) => {
          if (!controller.signal.aborted) state.set(name, json);
        },
      },
    },
  );
  await client.init();
  expect(state.get("$greeting")).toBe('"Hello SDK"');
  expect(JSON.parse(state.get("$initial")!)).toEqual({
    nested: [1, true, null],
  });
  const first = client.handleAction("deferred", '{"target":"$first"}');
  const second = client.handleAction("deferred", '{"target":"$second"}');
  await expect.poll(() => pending.size).toBe(2);
  pending.get("$second")!("second");
  pending.get("$first")!("first");
  await Promise.all([first, second]);
  await expect.poll(() => state.get("$first")).toBe('"first"');
  expect(state.get("$second")).toBe('"second"');
  await client.handleAction("fail", '{"target":"$error"}');
  await expect.poll(() => state.get("$error")).toContain("Tool failed");
  await client.handleAction("unknown", '{"target":"$unknown"}');
  await expect.poll(() => state.get("$unknown")).toContain("Unknown host tool");
  const stale = client.handleAction("deferred", '{"target":"$stale"}');
  await expect.poll(() => pending.has("$stale")).toBe(true);
  controller.abort();
  await stale;
  pending.get("$stale")!("stale");
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(state.has("$stale")).toBe(false);

  const originalArtifact = await readFile(result.file);
  const recoveryGuest = join(outDir, "recovery.ts");
  const options = {
    entry: recoveryGuest,
    outDir,
    name: "guest",
    witFiles: ["examples/custom-wit/wit/extension.wit"],
    worldName: "custom-client",
  };
  await writeFile(recoveryGuest, "this is invalid TypeScript!");
  await expect(buildWasm(options)).rejects.toThrow();
  expect(Buffer.compare(await readFile(result.file), originalArtifact)).toBe(0);
  await writeFile(
    recoveryGuest,
    await readFile("packages/build/test/guest.ts"),
  );
  const recovered = await buildWasm(options);
  expect(recovered.file).toBe(result.file);
  expect((await readFile(recovered.file)).subarray(0, 4)).toEqual(
    Buffer.from([0, 97, 115, 109]),
  );

  const invalidWit = join(outDir, "invalid.wit");
  const invalidGuest = join(outDir, "invalid.ts");
  await writeFile(invalidWit, "package druid:openui; world invalid {}\n");
  await writeFile(invalidGuest, "globalThis.marker = 1;\n");
  await expect(
    buildWasm({
      entry: invalidGuest,
      outDir,
      name: "invalid",
      witFiles: [invalidWit],
      worldName: "invalid",
    }),
  ).rejects.toThrow("must export druid:openui/client");
}, 120_000);
