// @vitest-environment node
import { expect, it, vi, beforeEach } from "vitest";
import { resolve } from "node:path";
import { druidUI } from "./vite";
import { buildWasm } from "./index";
vi.mock("./index", () => ({ buildWasm: vi.fn() }));
const invoke = (hook: any, ...args: any[]) =>
  typeof hook === "function" ? hook(...args) : hook.handler(...args);
beforeEach(() =>
  vi
    .mocked(buildWasm)
    .mockReset()
    .mockResolvedValue({
      file: "/app/public/client/index.wasm",
      dependencies: [
        "/app/src/client/index.ts",
        "/app/wit/custom.wit",
        "/app/shared/helper.ts",
      ],
    }),
);
const server = () => ({ watcher: { add: vi.fn() }, ws: { send: vi.fn() } });

it("builds Rust guests, watches Rust/Cargo inputs, and ignores compiler outputs", async () => {
  const plugin = druidUI({
    entry: "guest/Cargo.toml",
    language: "rust",
    name: "index",
  });
  const host = server();
  vi.mocked(buildWasm).mockResolvedValue({
    file: "/app/public/client/index.wasm",
    dependencies: ["/app/guest/Cargo.toml", "/app/guest/src/lib.rs"],
  });
  invoke(plugin.configResolved, { root: "/app" });
  await invoke(plugin.configureServer, host);
  expect(buildWasm).toHaveBeenCalledWith(
    expect.objectContaining({
      entry: "/app/guest/Cargo.toml",
      language: "rust",
    }),
  );
  await invoke(plugin.handleHotUpdate, { file: "/app/guest/src/new.rs" });
  await invoke(plugin.handleHotUpdate, { file: "/app/guest/Cargo.lock" });
  await invoke(plugin.handleHotUpdate, {
    file: "/app/guest/target/generated.rs",
  });
  expect(buildWasm).toHaveBeenCalledTimes(3);
});

it("watches graph/WIT dependencies and ignores unrelated host changes", async () => {
  const plugin = druidUI({ entry: "src/client/index.ts" });
  const host = server();
  invoke(plugin.configResolved, { root: "/app" });
  await invoke(plugin.configureServer, host);
  await invoke(plugin.handleHotUpdate, { file: "/app/src/App.tsx" });
  expect(buildWasm).toHaveBeenCalledTimes(1);
  await invoke(plugin.handleHotUpdate, { file: "/app/wit/custom.wit" });
  await invoke(plugin.handleHotUpdate, { file: "/app/shared/helper.ts" });
  expect(buildWasm).toHaveBeenCalledTimes(3);
  expect(host.watcher.add).toHaveBeenCalledWith("/app/wit/custom.wit");
});

it("reports build failures without reloading and recovers on the next change", async () => {
  const plugin = druidUI({ entry: "src/client/index.ts" });
  const host = server();
  invoke(plugin.configResolved, { root: "/app" });
  await invoke(plugin.configureServer, host);
  host.ws.send.mockClear();
  vi.mocked(buildWasm).mockRejectedValueOnce(new Error("Syntax error"));
  await invoke(plugin.handleHotUpdate, { file: "/app/src/client/index.ts" });
  expect(host.ws.send).toHaveBeenCalledWith(
    expect.objectContaining({ type: "error" }),
  );
  expect(host.ws.send).not.toHaveBeenCalledWith({ type: "full-reload" });
  await invoke(plugin.handleHotUpdate, { file: "/app/src/client/index.ts" });
  expect(host.ws.send).toHaveBeenLastCalledWith({ type: "full-reload" });
});

it("serializes overlapping rebuilds and queues a final rebuild", async () => {
  const plugin = druidUI({ entry: "src/client/index.ts" });
  const host = server();
  invoke(plugin.configResolved, { root: "/app" });
  await invoke(plugin.configureServer, host);
  let release!: () => void;
  vi.mocked(buildWasm).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            file: "index.wasm",
            dependencies: ["/app/src/client/index.ts"],
          });
      }),
  );
  const first = invoke(plugin.handleHotUpdate, {
    file: "/app/src/client/index.ts",
  });
  const second = invoke(plugin.handleHotUpdate, {
    file: "/app/src/client/index.ts",
  });
  expect(buildWasm).toHaveBeenCalledTimes(2);
  release();
  await Promise.all([first, second]);
  expect(buildWasm).toHaveBeenCalledTimes(3);
});
