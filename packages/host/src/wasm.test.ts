import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadWasmClient } from "./wasm";
import type { PointerEvent } from "@druid-ui/client/types";

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

it("creates custom imports once with the guest lifetime signal", async () => {
  const controller = new AbortController(),
    disposed = vi.fn();
  const additionalImports = vi.fn((signal: AbortSignal) => {
    signal.addEventListener("abort", disposed, { once: true });
    return { "example:custom/api": {} };
  });
  vi.mocked(fetch).mockResolvedValue(new Response("Missing", { status: 404 }));
  await expect(
    loadWasmClient("/missing.wasm", controller.signal, state, {
      additionalImports,
    }),
  ).rejects.toThrow("404");
  expect(additionalImports).toHaveBeenCalledExactlyOnceWith(controller.signal);
  controller.abort();
  expect(disposed).toHaveBeenCalledOnce();
  await expect(
    loadWasmClient("/missing.wasm", controller.signal, state, {
      additionalImports,
    }),
  ).rejects.toThrow();
  expect(additionalImports).toHaveBeenCalledOnce();
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

it("dispatches optional pointer exports directly and stops them after guest disposal", async () => {
  const receive = vi.fn(),
    onError = vi.fn();
  vi.stubGlobal("__pointerTestReceive", receive);
  vi.stubGlobal("__pointerTestEnabled", false);
  const script = `export async function instantiate(){return {client:{init:async()=>{},handleAction:async()=>{}},pointer:globalThis.__pointerTestEnabled?{handleEvent:async event=>globalThis.__pointerTestReceive(event)}:undefined};}`;
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL() {
        return `data:text/javascript,${encodeURIComponent(script)}`;
      }
      static revokeObjectURL = revoke;
    },
  );
  worker.postMessage.mockImplementation(() =>
    worker.onmessage?.(
      new MessageEvent("message", {
        data: { files: [["client.js", new TextEncoder().encode(script)]] },
      }),
    ),
  );
  const plain = await loadWasmClient(
    "/plain.wasm",
    new AbortController().signal,
    state,
  );
  expect(plain.dispatchPointer).toBeUndefined();
  vi.stubGlobal("__pointerTestEnabled", true);
  const controller = new AbortController();
  const client = await loadWasmClient(
    "/pointer.wasm",
    controller.signal,
    state,
    { onError },
  );
  const event: PointerEvent = {
    region: "art",
    kind: "move",
    pointerId: 1,
    device: "mouse",
    x: 2,
    y: 3,
    width: 100,
    height: 100,
    movementX: 2,
    movementY: 3,
    wheelX: 0,
    wheelY: 0,
    button: -1,
    buttons: 0,
    pressure: 0,
    shift: false,
    control: false,
    alt: false,
    meta: false,
    timestamp: 4,
  };
  client.dispatchPointer!(event);
  expect(receive).toHaveBeenCalledExactlyOnceWith(event);
  receive.mockRejectedValueOnce(new Error("Pointer guest failed"));
  client.dispatchPointer!(event);
  await vi.waitFor(() =>
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Pointer guest failed" }),
    ),
  );
  controller.abort();
  receive.mockClear();
  client.dispatchPointer!(event);
  expect(receive).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledTimes(2);
});
