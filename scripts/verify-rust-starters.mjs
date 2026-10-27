import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, cp, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { buildWasm } from "@druid-ui/build";
import { generate, $init } from "@bytecodealliance/jco-transpile/component";

await $init;
async function load(example, tools, extra = {}) {
  const custom = example === "custom-wit";
  const result = await buildWasm({
    entry: `examples/${example}/guest/Cargo.toml`,
    language: "rust",
    name: "index",
    outDir: `.verification/rust-starters/${example}`,
    ...(custom
      ? {
          witFiles: ["examples/custom-wit/wit/extension.wit"],
          worldName: "custom-client",
        }
      : {}),
  });
  assert.ok(result.dependencies.some((file) => file.endsWith("/src/lib.rs")));
  assert.ok(result.dependencies.some((file) => file.endsWith("/Cargo.lock")));
  const { files } = generate(await readFile(result.file), {
    name: "client",
    instantiation: { tag: "async" },
    noTypescript: true,
    noNodejsCompat: true,
    base64Cutoff: 0,
  });
  const assets = new Map(files);
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(assets.get("client.js")).toString("base64")}`
  );
  const values = new Map();
  const calls = [];
  const { client } = await module.instantiate(
    (file) => WebAssembly.compile(assets.get(file)),
    {
      ...extra,
      "druid:openui/host": {
        log() {},
        async call(name, json) {
          const params = JSON.parse(json);
          calls.push({ name, params });
          if (!Object.hasOwn(tools, name)) throw `Unknown host tool: ${name}`;
          return JSON.stringify(await tools[name](params));
        },
      },
      "druid:openui/state": {
        getValue: (name) => values.get(name),
        setValue: (name, json) => values.set(name, json),
      },
    },
  );
  await client.init();
  return {
    client,
    calls,
    values,
    value: (name) => JSON.parse(values.get(name)),
    action: (name, params = {}) =>
      client.handleAction(name, JSON.stringify(params)),
  };
}

const settings = await load("starter", {
  preview_settings: async (params) => {
    if (params.serverName === "fail") throw "Preview rejected by host";
    return { message: `Previewing ${params.serverName}` };
  },
});
await settings.action("PreviewSettings", {
  serverName: 'Rust "settings"',
  players: "20",
  difficulty: "normal",
});
assert.equal(settings.value("$previewText"), 'Previewing Rust "settings"');
assert.deepEqual(settings.calls[0].params, {
  serverName: 'Rust "settings"',
  players: "20",
  difficulty: "normal",
});
await settings.action("PreviewSettings", { serverName: "fail" });
assert.equal(settings.value("$previewText"), "Preview rejected by host");
console.log(
  "PASS Rust settings starter: native async preview, JSON params, errors",
);

const message = await load("starter-component", {
  load_message: async (params) => {
    if (params.fail) throw "Denied";
    return "Message from Rust";
  },
});
await message.action("LoadMessage");
assert.equal(message.value("$message"), "Message from Rust");
await message.action("LoadMessage", { fail: true });
assert.equal(message.value("$message"), "Denied");
const before = message.calls.length;
await message.action("UnknownAction");
assert.equal(message.calls.length, before);
console.log("PASS Rust guest-only starter: host result/error, unknown actions");

let text = "saved text";
const tools = await load("starter-component-plattform", {
  file_read: async () => text,
  file_write: async (params) => {
    text = params.content;
    return { ok: true };
  },
  http_get: async () => ({ online: true }),
});
await tools.action("ReadFile");
assert.equal(tools.value("$content"), text);
await tools.action("WriteFile", { content: "edited" });
assert.equal(text, "edited");
assert.deepEqual(tools.calls.at(-1), {
  name: "file_write",
  params: { path: "server.properties", content: "edited" },
});
await tools.action("FetchStatus");
assert.deepEqual(JSON.parse(tools.value("$output")), { online: true });
await tools.client.handleAction("WriteFile", "invalid JSON");
assert.match(tools.value("$output"), /expected/);
console.log(
  "PASS Rust tools starter: file read/write, HTTP and malformed action data",
);

const custom = await load(
  "custom-wit",
  {},
  {
    "example:custom/extension": {
      greet: (name) => `Hello ${name} from custom WIT`,
    },
  },
);
assert.equal(custom.value("$greeting"), "Hello Druid from custom WIT");
await custom.action("Greet");
assert.equal(custom.value("$greeting"), "Hello custom world from custom WIT");
console.log(
  "PASS Rust custom-world starter: canonical SDK plus typed custom import",
);

// Exercise the compiler failure path using an isolated copy, never editing a starter.
await mkdir(".verification", { recursive: true });
const recovery = await mkdtemp(resolve(".verification/rust-recovery-"));
await cp("examples/starter-component/guest", join(recovery, "guest"), {
  recursive: true,
  filter: (file) => !/[/\\]target(?:[/\\]|$)/.test(file),
});
const options = {
  entry: join(recovery, "guest/Cargo.toml"),
  language: "rust",
  name: "index",
  outDir: join(recovery, "dist"),
};
const built = await buildWasm(options);
const original = await readFile(built.file);
const source = join(recovery, "guest/src/lib.rs");
const valid = await readFile(source);
await writeFile(source, "invalid Rust source!");
await assert.rejects(buildWasm(options), /Rust guest build failed/);
assert.deepEqual(await readFile(built.file), original);
await writeFile(source, valid);
await buildWasm(options);
assert.deepEqual(
  (await readFile(built.file)).subarray(0, 4),
  Buffer.from([0, 97, 115, 109]),
);
console.log(
  "PASS Rust compiler failure preserves the previous artifact and recovers",
);
