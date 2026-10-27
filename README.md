# Druid UI — OpenUI + WASM SDK

Authored OpenUI Lang describes the view. React renders it. A WASM client handles
named actions, updates state, and calls explicitly registered host tools. Rust is
the preferred guest language; the starters and generated projects use it by default.
React/TypeScript remains the host language, and TypeScript guests remain supported.

| Package            | Responsibility                                                 |
| ------------------ | -------------------------------------------------------------- |
| `@druid-ui/host`   | React runtime, asset loading, state bridge, instance lifecycle |
| `@druid-ui/client` | Lightweight async guest SDK and canonical WIT                  |
| `@druid-ui/build`  | Guest builds, type generation, Vite integration (`/vite`)      |
| `create-druid-ui`  | Full-app, guest-only, and custom-WIT scaffolding               |

```sh
rustup target add wasm32-unknown-unknown
npm ci
npm run build
npm test
npm run dev:openui
```

The starter runs at http://127.0.0.1:5173. Preview performs an asynchronous
WASM → host-tool → WASM → state update. Save uses an OpenUI mutation. Set the
server name to `fail` to exercise a rejected guest tool call. Values are local
to the page; there is no backend in the demo.

The [examples](examples/README.md) also cover counter/routing, async HTTP,
file/config editing, custom React components, and guest-only host-tool calls.

```tsx
import { OpenUIHost } from "@druid-ui/host";

<OpenUIHost
  library={library}
  openUiSourceUrl="/view.openui"
  wasmUrl="/client/index.wasm"
  toolProvider={{
    load_message: async (args, { signal }) => {
      const response = await fetch("/api/message", { signal });
      if (!response.ok) throw new Error("Load failed");
      return response.json();
    },
  }}
/>;
```

`WasmRoot` accepts a document through `response` and renders caller-supplied
children. `OpenUIHost` fetches a document and defaults to `Renderer.Content`.
Omit `wasmUrl` for ordinary OpenUI without guest behavior. Theme/styles belong
to the application, not the runtime.

## Guest behavior

```rust
// Inside the generated client trait's async handle_action implementation:
match host::call("load_message".to_owned(), params).await {
    Ok(json) => state::set_value("$message", &json),
    Err(error) => state::set_value("$message", &serde_json::json!(error).to_string()),
}
```

The complete Rust trait and `wit_bindgen::generate!` setup live in
[the guest-only starter](examples/starter-component/guest/src/lib.rs).
The build tool supplies `DRUID_WIT_PATH` from the installed `@druid-ui/client`;
there is no copied SDK WIT. Keep each guest's `Cargo.lock`.
TypeScript guests can still use `createClient` and `callTool` from `@druid-ui/client`.

`host.call` is a native async WIT function returning `result<string, string>`.
Guest code awaits it directly; there are no SDK request IDs, pending Promise maps,
or `client.complete` export. `init` and `handle-action` are async exports as well.
Host tools receive an instance AbortSignal. Reload/unmount rejects pending work,
even when a handler ignores cancellation, and suppresses stale state updates.
There are no automatic retries or global callback queues.

State access covers top-level fields and `$variables`. Values cross WIT as JSON;
an absent value differs from JSON null. DOM construction, browser event objects,
render hooks, and manual rerender are not guest capabilities.

## Building and extending

Use `druid-ui-build guest/Cargo.toml dist --rust --name=index`, or
`druidUI({ entry: "guest/Cargo.toml", language: "rust", name: "index" })`
from `@druid-ui/build/vite`. Stable Rust/Cargo and the
`wasm32-unknown-unknown` target are required. Rust builds are locked and use
`wit-bindgen` for bindings; the build tool wraps the core module as a component.
For TypeScript, use `druid-ui-build src/index.ts dist` and
`druid-ui-gen-types generated` as before.
The plugin uses real WASM in development, rebuilds guest/WIT dependencies, and
retains the last artifact when a build fails. Build staging stays in the output
directory. The plugin also configures JCO's browser asset handling.

TypeScript guests are compiled with QuickJS (`componentize-qjs` 0.5.0); browser bindings use
JCO's standalone transpiler (`@bytecodealliance/jco-transpile` 0.20.0).
ComponentizeJS/StarlingMonkey is not part of the build. Versions are pinned;
rerun packed-package, real WASM, and browser checks when upgrading.

Native async requires WebAssembly JSPI (`WebAssembly.Suspending` and
`WebAssembly.promising`). Use Node.js 24+ for development/tests and a JSPI-capable
browser; unsupported engines show an explicit error. There is no synchronous
fallback. OpenUI documents without WASM do not need JSPI.

Additional WIT is supplied with repeated `--wit=file` and `--world-name=name`.
Custom worlds must import host/state and export `druid:openui/client`; direct
typed imports are bound through `additionalImports`. Reserved host/state imports
cannot be overridden. See [custom-wit](examples/custom-wit).

`fetchResource` customizes document/WASM downloads (for example, authenticated
fetch). `reloadKey` explicitly reloads an unchanged URL. Tool/callback changes
do not reload the guest; changes to additional imports or download policy take
effect on the next reload. `onRuntimeError` reports runtime failures.

## Safety and migration

Only register capabilities the guest may use. Authentication, path validation,
deployment scope, command approval, and HTTP confirmation belong in the trusted
host handlers. Custom imports must follow the same policy. Mark asynchronous
custom WIT functions `async`; only those imports may return JavaScript Promises.

This is the breaking v4 SDK. Old renderer packages and raw JavaScript mode are
not supported. Existing applications must remain pinned to their previous SDK
until their documents, guest behavior, asset delivery, and host tools are migrated.
This repository change does not migrate or deploy those applications.

Verification: `npm run build:examples`, `npm run verify:packages`, and with the
starter running `npm run test:assets --workspace=druid-openui-starter`.
`npm run test:rust` compiles and executes the Rust starters and the dedicated Rust example.
