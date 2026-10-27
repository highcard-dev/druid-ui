import assert from "node:assert/strict";
const base = new URL(process.argv[2] ?? "http://127.0.0.1:5173/");
async function load(url) {
  const result = await fetch(url);
  assert.ok(result.ok, `${url}: ${result.status}`);
  return result;
}
const app = await (await load(new URL("src/App.tsx", base))).text();
const sdk = app.match(
  /from\s*["']([^"']*(?:@druid-ui\/host|packages\/host)[^"']*)["']/,
);
assert.ok(sdk, "Demo must use the SDK package export");
const sdkUrl = new URL(sdk[1], base);
const module = await (await load(sdkUrl)).text();
const worker = module.match(
  /["']([^"']*wasm\.worker[^"']*\.js(?:\?[^"']*)?)["']/,
);
assert.ok(worker, "Runtime must reference its packaged worker");
const workerUrl = new URL(worker[1], sdkUrl);
const workerSource = await (await load(workerUrl)).text();
const binaries = [
  ...workerSource.matchAll(/data:application\/wasm;base64,([A-Za-z0-9+/=]+)/g),
];
assert.ok(
  binaries.length >= 2,
  "Packaged transpiler must contain its JCO WASM assets",
);
for (const [, bytes] of binaries)
  await WebAssembly.compile(Buffer.from(bytes, "base64"));
const client = await load(new URL("client/index.wasm", base));
assert.equal(
  client.headers.get("content-type")?.split(";")[0],
  "application/wasm",
);
assert.deepEqual(
  [...new Uint8Array(await client.arrayBuffer()).slice(0, 4)],
  [0, 97, 115, 109],
);
console.log("PASS packaged worker, JCO cores, and guest WASM asset");
