# Druid UI — OpenUI + WASM SDK

The breaking v4 release candidate is `4.0.0-rc.1`, available through the npm
`next` channel after publication. Stable `latest` remains on v3. See the
[release notes](docs/releases/v4.0.0-rc.1.md) for opt-in installation and migration requirements.

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

### Browser graphics and media

The host includes standalone typed WIT imports for Canvas 2D, WebGL2, WebGPU,
Web Audio, video/WebCodecs and animation timing. They need no Druid platform or
JSON tools. Select the SDK's `browser-client` world, or import individual
interfaces in a custom world. Each API has its own WIT file under
`packages/client/wit/`. Register the shared `browserComponents` from
`@druid-ui/host` in your OpenUI library: `[...browserComponents, ...yourComponents]`.
This supplies Canvas, Video, Keyboard and Pointer schemas, rendering and authoring guidance
without redefining them in every app. The React surfaces remain available directly.
The host manages their instance-local resources and cleanup.

For keyboard input, register `BrowserKeyboard` in your library and wrap the
interactive content with an instance-local `id` and explicit `codes` (e.g.
`["Space", "ArrowLeft"]`). The guest exports `keyboard.handle-event` from
`keyboard.wit`; `browser-client` includes this export. Events are typed key-down,
key-up and focus-loss records with physical code, logical key, modifiers, repeat
and timestamp. They call the guest directly, without JSON or frame polling.
Only the focused region receives keys. Native controls/editable fields are left
alone, and modified browser shortcuts are not cancelled. Regions are inert in
isolated previews or guests without the keyboard export.

For mouse/pen/touch input, compose `Pointer("scene", ["move", "down", "up", "wheel"], [Canvas("scene", 640, 400)], "Scene controls")`.
Guests export `pointer.handle-event` from `pointer.wit` (included in `browser-client`).
The host also exports `BrowserPointer` for React composition. Coordinates/dimensions
are region-relative CSS pixels: map `x * backingWidth / width` into a canvas.
Button bitmasks, pressure, device, modifiers, movement and normalized wheel deltas
are typed WIT fields, not JSON actions. Moves coalesce once per pointer per frame;
down/up/click/wheel are immediate. Dragging captures the pointer beyond the region.
Cancel/blur always release held state. Native controls and unregistered events are
untouched; modified wheel gestures retain browser defaults. Set the optional
`preventContextMenu` functional prop only when right-click belongs to the UI.
Active regions disable touch panning; previews and guests without this export are
inert. Pointer lock/global listeners are intentionally not provided.

Use `Viewport(surface, children)` with `Overlay("top" | "bottom" | "center", children, interactive?)`
for accessible controls inside a drawing surface. For example,
`Viewport(Canvas("world", 960, 640), [Overlay("top", [TextContent("HP 100")], false)])`
keeps a click-through HUD within the canvas bounds. Center panels are bounded and
scrollable; ordinary buttons and inputs stay native, not painted into the GPU.
Register your own content/control components alongside `browserComponents`.

Custom typed imports may use `additionalImports={(signal) => imports}`. The
factory runs once per guest and receives its lifetime signal; use it to release
resources and pending operations on unmount, replacement or failed loading.
Ordinary import maps are still supported. Reserved SDK imports cannot be replaced.

The browser world's `druid:openui/http.request(options)` supports methods, headers
and optional binary request bodies, returning status, CORS-visible headers and a
`list<u8>` response directly into WASM without JSON/base64 or `callTool`.
Import `http` in a custom world or include `browser-client`. In Rust, for example:

```rust
let response = http::request(http::RequestOptions {
    url: "https://assets.example/characters.tar".into(),
    method: "GET".into(), headers: vec![], body: None,
}).await?;
let bytes = response.body;
```

Both typed HTTP and JSON host tools can use the exported `requestHttp` implementation.
It uses browser HTTP/CORS, omits credentials, rejects non-success statuses and cancels
with the guest. GET/HEAD ignore bodies. Every request requires confirmation,
including retries; denial sends no request and approval is never remembered.
Supply `confirmHttpRequest={(url) => showYourConfirmationModal(url)}` to
`OpenUIHost`/`WasmRoot` (or the loader option) to use an asynchronous application
modal. Reject that promise on denial; resolving approves the request. Druid's
public and private hosts supply their existing confirmation modal. Standalone
hosts default to native browser confirmation. Package loading remains separate:
fetching the host's WASM/OpenUI pair does not trigger this guest-request prompt.
Serve assets with
appropriate CORS headers; a single uncompressed GLB/tar can avoid runtime ZIP
decompression. WebGL matrix uniforms also accept mat4 arrays for GPU skinning.

Rendering uses batches and binary lists, with persistent GPU resources. Audio
DSP uses a dedicated WASM AudioWorklet. This is a focused interface, not a full
Web API mirror or a zero-copy guarantee. See the [browser API example](examples/browser-apis/README.md)
for supported operations, Rust code, browser checks and performance limits.

### Rust guests without Node/npm

Rust-only builds need Cargo, the WASM target and the native
[wasm-tools CLI](https://github.com/bytecodealliance/wasm-tools). They do not need
Node, npm or installed Druid npm packages:

```sh
rustup target add wasm32-unknown-unknown
cargo install --locked wasm-tools --version 1.262.0
# From this SDK checkout, for example:
./packages/client/build-rust.sh examples/starter-component/guest/Cargo.toml dist \
  --name=index --document=examples/starter-component/src/view.openui
```

For a standalone project, copy `packages/client/build-rust.sh` as `build.sh` and
its sibling `wit/` directory into the project. Keep that contract snapshot pinned with your
guest source and Cargo.lock. Generated default and guest-only projects already include these files.
Run `./build.sh guest/Cargo.toml dist --name=index --document=src/view.openui`.
The script supplies `DRUID_WIT_PATH`, compiles a locked release cdylib, wraps the
core module as a component, and verifies the Druid client export before replacing
outputs. Custom WIT can be selected explicitly with `DRUID_WIT_PATH`; the guest
still selects its own world in `wit_bindgen::generate!`.
A standard Rust container is sufficient; no combined Node/Rust image is needed.
Append `--watch` to rebuild when Rust, Cargo, WIT or the document changes, keeping
the last output on a build failure. The builder does not run a browser host or publish.

### Optional Node/Vite integration

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
typed imports are bound through `additionalImports`. Reserved host/state and built-in browser imports
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
