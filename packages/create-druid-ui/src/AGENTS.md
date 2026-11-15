# Druid OpenUI project

Prefer Rust for guest behavior in `guest/src/lib.rs`; React/TypeScript remains
the trusted rendering host. Views are authored in `.openui` documents.

- Rust implements the generated client trait. Await `host::call` for named host
  tools, and use `state` imports for JSON values. Bindings use the canonical WIT
  in `wit/`, passed by `build.sh` through `DRUID_WIT_PATH`. Custom-WIT
  projects use the selected world and the SDK's WIT assembly configuration.
- The host registers named tools with `WasmRoot` or `OpenUIHost`. Keep credentials,
  authorization, confirmations, and deployment scope in those trusted handlers.
- Write JSON-compatible state through the guest context; OpenUI updates the view.
- Keep React/browser code in the host. The guest's only capabilities are its WIT
  imports. Both development and production execute real WASM.
- For custom WIT, keep the selected world in `wit_bindgen::generate!` aligned with
  the build configuration. Bind custom imports through `additionalImports`;
  asynchronous custom functions must be `async func` in WIT.
- When `build.sh` is present, use `./build.sh guest/Cargo.toml dist --name=index --document=src/view.openui`;
  append `--watch` for rebuilds. Install stable Rust,
  the `wasm32-unknown-unknown` target and `wasm-tools` 1.262.0. Keep Cargo.lock.
  This path requires no Node/npm. Node 24+ is needed only for the optional npm
  tooling and browser host; the browser must support JSPI.
- After changes, build and exercise the browser flow, including a failed tool
  call. Preserve guest cancellation and host confirmation policies.
