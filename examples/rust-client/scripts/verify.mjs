import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { componentWit } from "@bytecodealliance/jco-transpile/wasm-tools";
import { generate, $init } from "@bytecodealliance/jco-transpile/component";

const bytes = await readFile(
  new URL("../public/client/index.wasm", import.meta.url),
);
const contract = await componentWit(bytes);
assert.deepEqual(
  [...contract.matchAll(/^\s*import ([^;]+);/gm)]
    .map((match) => match[1])
    .sort(),
  ["druid:openui/host", "druid:openui/state"],
);
await $init;
const generated = generate(bytes, {
  name: "client",
  instantiation: { tag: "async" },
  noTypescript: true,
  noNodejsCompat: true,
  base64Cutoff: 0,
});
const files = new Map(generated.files);
const module = await import(
  `data:text/javascript;base64,${Buffer.from(files.get("client.js")).toString("base64")}`
);
const cores = new Map();
async function instance() {
  const state = new Map();
  const calls = [];
  const { client } = await module.instantiate(
    async (name) => {
      if (!cores.has(name))
        cores.set(name, WebAssembly.compile(files.get(name)));
      return cores.get(name);
    },
    {
      "druid:openui/host": {
        log() {},
        call(operation, params) {
          return new Promise((resolve, reject) =>
            calls.push({
              operation,
              params: JSON.parse(params),
              status: JSON.parse(state.get("$status")),
              resolve,
              reject,
            }),
          );
        },
      },
      "druid:openui/state": {
        getValue: (name) => state.get(name),
        setValue: (name, json) => state.set(name, json),
      },
    },
  );
  await client.init();
  assert.equal(client.complete, undefined);
  return { client, calls, value: (name) => JSON.parse(state.get(name)), state };
}
async function until(test) {
  for (let i = 0; i < 100; i++) {
    if (test()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.fail("Timed out waiting for Rust async host import");
}
const first = await instance();
await first.client.handleAction("Increment", "{}");
await first.client.handleAction("Increment", "{}");
assert.equal(first.value("$count"), 2);
const a = first.client.handleAction(
  "Greet",
  JSON.stringify({ name: 'Alice "quoted"', target: "$first" }),
);
const b = first.client.handleAction(
  "Greet",
  JSON.stringify({ name: "Bob", target: "$second" }),
);
await until(() => first.calls.length === 2);
assert.deepEqual(
  first.calls.map(({ operation, params, status }) => ({
    operation,
    params,
    status,
  })),
  [
    {
      operation: "greet",
      params: { name: 'Alice "quoted"' },
      status: "Pending requests: 1",
    },
    {
      operation: "greet",
      params: { name: "Bob" },
      status: "Pending requests: 2",
    },
  ],
);
first.calls[1].resolve('{"message":"Second result"}');
await b;
assert.equal(first.value("$second"), "Second result");
assert.equal(first.value("$first"), "Loading…");
first.calls[0].resolve(
  JSON.stringify({ message: 'First "result"\nwith newline' }),
);
await a;
assert.equal(first.value("$first"), 'First "result"\nwith newline');
assert.equal(first.value("$status"), "Pending requests: 0");
for (const [method, value] of [
  ["reject", "Denied"],
  ["resolve", "invalid JSON"],
  ["resolve", "{}"],
]) {
  const count = first.calls.length;
  const action = first.client.handleAction(
    "Greet",
    '{"name":"fail","target":"$first"}',
  );
  await until(() => first.calls.length > count);
  first.calls.at(-1)[method](value);
  await action;
  assert.match(first.value("$first"), /^Error:/);
  assert.equal(first.value("$status"), "Pending requests: 0");
}
await first.client.handleAction("Greet", "invalid JSON");
assert.match(first.value("$status"), /Invalid action JSON/);
const count = first.calls.length;
await first.client.handleAction("Greet", '{"name":"bad","target":"$count"}');
assert.equal(first.calls.length, count);
assert.equal(first.value("$count"), 2);
const second = await instance();
assert.equal(second.value("$count"), 0);
const old = new Map(first.state);
const next = second.client.handleAction(
  "Greet",
  '{"name":"Independent","target":"$first"}',
);
await until(() => second.calls.length === 1);
second.calls[0].resolve('{"message":"Independent"}');
await next;
assert.equal(second.value("$first"), "Independent");
assert.deepEqual(first.state, old);
console.log(
  "PASS real Rust native async: canonical WIT, state/actions, out-of-order calls, errors/malformed data, instance isolation; no request IDs or complete export",
);
