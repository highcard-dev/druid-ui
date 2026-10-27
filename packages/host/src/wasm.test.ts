import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadWasmClient } from "./wasm";

const state = { getValue: vi.fn(), setValue: vi.fn() };

const worker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: undefined as ((event: MessageEvent) => void) | undefined,
  onerror: undefined as ((event: ErrorEvent) => void) | undefined,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([0]))),
  );
  vi.stubGlobal(
    "Worker",
    vi.fn(function () {
      return worker;
    }),
  );
  worker.postMessage.mockClear();
  worker.terminate.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("rejects failed WASM HTTP requests before transpiling", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("Missing", { status: 404 }));
  await expect(
    loadWasmClient("/missing.wasm", new AbortController().signal, state),
  ).rejects.toThrow("WASM request failed (404)");
  expect(Worker).not.toHaveBeenCalled();
});

it("reports a missing JSPI engine before downloading or creating a worker", async () => {
  vi.stubGlobal("WebAssembly", {});
  await expect(
    loadWasmClient("/client.wasm", new AbortController().signal, state),
  ).rejects.toThrow("requires WebAssembly JSPI");
  expect(fetch).not.toHaveBeenCalled();
  expect(Worker).not.toHaveBeenCalled();
});

it.each(["druid:openui/host", "druid:openui/state"])(
  "rejects overriding reserved import %s",
  async (name) => {
    await expect(
      loadWasmClient("/client.wasm", new AbortController().signal, state, {
        additionalImports: { [name]: {} },
      }),
    ).rejects.toThrow("Reserved WIT import");
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("uses the caller's authenticated resource fetch and cancellation signal", async () => {
  const fetchResource = vi.fn(
    async () => new Response("Denied", { status: 403 }),
  );
  const signal = new AbortController().signal;
  await expect(
    loadWasmClient("/private.wasm", signal, state, { fetchResource }),
  ).rejects.toThrow("403");
  expect(fetchResource).toHaveBeenCalledWith("/private.wasm", { signal });
  expect(fetch).not.toHaveBeenCalled();
});

it("terminates the worker and propagates transpilation errors", async () => {
  worker.postMessage.mockImplementation(() =>
    worker.onmessage?.(
      new MessageEvent("message", { data: { error: "Invalid component" } }),
    ),
  );
  await expect(
    loadWasmClient("/bad.wasm", new AbortController().signal, state),
  ).rejects.toThrow("Invalid component");
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it("terminates pending transpilation when the effect is cancelled", async () => {
  const controller = new AbortController();
  worker.postMessage.mockImplementation(() => controller.abort());
  await expect(
    loadWasmClient("/client.wasm", controller.signal, state),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it("rejects a missing generated entrypoint", async () => {
  worker.postMessage.mockImplementation(() =>
    worker.onmessage?.(new MessageEvent("message", { data: { files: [] } })),
  );
  await expect(
    loadWasmClient("/client.wasm", new AbortController().signal, state),
  ).rejects.toThrow("did not return client.js");
});

it("times out and terminates an unresponsive worker", async () => {
  vi.useFakeTimers();
  worker.postMessage.mockImplementation(() => {});
  const result = loadWasmClient(
    "/client.wasm",
    new AbortController().signal,
    state,
  );
  const rejection = expect(result).rejects.toThrow(
    "WASM transpilation timed out",
  );
  await vi.advanceTimersByTimeAsync(30_000);
  await rejection;
  expect(worker.terminate).toHaveBeenCalledOnce();
});
