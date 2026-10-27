import type {
  ClientExports,
  StateImports,
  HostImports,
} from "@druid-ui/client/types";
import { createToolSession, type ToolSession } from "./tools";

export interface WasmClient {
  dispatch(action: string, params: unknown): void;
}

export type WasmState = StateImports;
export type ResourceFetcher = typeof globalThis.fetch;
export type AdditionalImports = Record<string, Record<string, unknown>>;
export interface WasmLoadOptions {
  fetchResource?: ResourceFetcher;
  additionalImports?: AdditionalImports;
  session?: ToolSession;
  onError?: (error: unknown) => void;
}

type TranspiledFiles = Array<[string, Uint8Array]>;

function transpile(
  buffer: ArrayBuffer,
  signal: AbortSignal,
): Promise<TranspiledFiles> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./wasm.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(signal.reason);
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error("WASM transpilation timed out"));
    }, 30_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<{ files: TranspiledFiles } | { error: string }>,
    ) => {
      finish();
      if ("error" in event.data) reject(new Error(event.data.error));
      else resolve(event.data.files);
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "WASM transpilation failed"));
    };
    try {
      worker.postMessage(buffer, [buffer]);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}

export async function loadWasmClient(
  url: string,
  signal: AbortSignal,
  state: WasmState,
  options: WasmLoadOptions = {},
): Promise<WasmClient> {
  for (const name of ["druid:openui/host", "druid:openui/state"]) {
    if (Object.hasOwn(options.additionalImports ?? {}, name))
      throw new Error(`Reserved WIT import: ${name}`);
  }
  const engine = WebAssembly as typeof WebAssembly & {
    Suspending?: unknown;
    promising?: unknown;
  };
  if (
    typeof engine.Suspending !== "function" ||
    typeof engine.promising !== "function"
  )
    throw new Error(
      "This WASM client requires WebAssembly JSPI (Suspending/promising). Use a JSPI-capable browser or Node.js 24+.",
    );
  const response = await (options.fetchResource ?? globalThis.fetch)(url, {
    signal,
  });
  if (!response.ok) throw new Error(`WASM request failed (${response.status})`);
  const files = await transpile(await response.arrayBuffer(), signal);
  signal.throwIfAborted();
  const javascript = files.find(([name]) => name === "client.js");
  if (!javascript) throw new Error("WASM transpiler did not return client.js");

  const moduleUrl = URL.createObjectURL(
    new Blob([new Uint8Array(javascript[1])], { type: "text/javascript" }),
  );
  try {
    const { instantiate } = (await import(/* @vite-ignore */ moduleUrl)) as {
      instantiate(
        compile: (filename: string) => Promise<WebAssembly.Module>,
        imports: {
          "druid:openui/host": HostImports;
          "druid:openui/state": WasmState;
        } & AdditionalImports,
      ): Promise<{ client: ClientExports }>;
    };
    const session = options.session ?? createToolSession(signal, () => ({}));
    const { client } = await instantiate(
      async (filename) => {
        signal.throwIfAborted();
        const file = files.find(([name]) => name === filename);
        if (!file) throw new Error(`Missing WASM core module: ${filename}`);
        return WebAssembly.compile(new Uint8Array(file[1]));
      },
      {
        ...options.additionalImports,
        "druid:openui/host": {
          log: (message) => {
            if (!signal.aborted) console.info("[OpenUI WASM]", message);
          },
          call: session.call,
        },
        "druid:openui/state": {
          getValue: (name) =>
            signal.aborted ? undefined : state.getValue(name),
          setValue: (name, json) => {
            if (!signal.aborted) state.setValue(name, json);
          },
        },
      },
    );
    signal.throwIfAborted();
    await client.init();
    signal.throwIfAborted();
    return {
      dispatch(action, params) {
        signal.throwIfAborted();
        void client
          .handleAction(action, JSON.stringify(params) ?? "null")
          .catch((error) => {
            if (!signal.aborted) (options.onError ?? console.error)(error);
          });
      },
    };
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}
