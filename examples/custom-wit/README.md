# Rust custom WIT starter

Requires Node 24+, stable Rust/Cargo, the `wasm32-unknown-unknown` target and a
JSPI-capable browser. `npm run dev` starts the React/TypeScript host and builds
the Rust guest in `guest/src/lib.rs`. The guest imports a typed
`greet` function; `additionalImports` supplies it. `npm run build` type-checks
and builds the complete application. Named tools provide async host work without
additional WIT. Custom functions may also use `async func` and Promise-returning
`additionalImports`; synchronous WIT imports must remain synchronous.
`wit-bindgen` generates Rust bindings at compile time from `wit/extension.wit`
and the SDK's canonical WIT. Keep `custom-client` aligned in the macro and Vite
configuration, and retain `guest/Cargo.lock`. Rust/WIT edits trigger rebuilds.
