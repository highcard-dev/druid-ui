# Druid OpenUI project

Prefer Rust for guest behavior in `guest/src/lib.rs`; React/TypeScript remains
the trusted rendering host. Views are authored in `.openui` documents.

- Rust implements the generated client trait. Await `host::call` for named host
  tools, and use `state` imports for JSON values. Bindings use the canonical WIT
  from `@druid-ui/client`, resolved by the build tool through `DRUID_WIT_PATH`.
- The host registers named tools with `WasmRoot` or `OpenUIHost`. Keep credentials,
  authorization, confirmations, and deployment scope in those trusted handlers.
- Write JSON-compatible state through the guest context; OpenUI updates the view.
- Keep React/browser code in the host. The guest's only capabilities are its WIT
  imports. Both development and production execute real WASM.
- For custom WIT, keep the selected world in `wit_bindgen::generate!` aligned with
  the build configuration. Bind custom imports through `additionalImports`;
  asynchronous custom functions must be `async func` in WIT.
- Keep Cargo.lock for reproducible builds. Use stable Rust, the
  `wasm32-unknown-unknown` target, Node 24+, and a JSPI-capable browser.
- After changes, build and exercise the browser flow, including a failed tool
  call. Preserve guest cancellation and host confirmation policies.
