# Rust WASM client

The React/OpenUI host is unchanged; the guest is Rust instead of TypeScript.
It implements the SDK's native async `init` and `handle-action` exports directly.

## Run

Requires stable Rust/Cargo on PATH, Node.js 24+, a JSPI-capable browser, and the WebAssembly target:

```sh
rustup target add wasm32-unknown-unknown
npm ci
npm run build
npm run dev --workspace=druid-rust-example
```

Run from the repository root. Increment the Rust counter, enter a name, and click
either greeting button. The host resolves the asynchronous `greet` tool and Rust
writes the returned message to the corresponding field. Enter `fail` to exercise
an error returning from the awaited host call.

```sh
npm run build --workspace=druid-rust-example
npm run test:rust
```

The integration check compiles and runs the actual Rust component through JCO.
It covers JSON state, named actions, concurrent/out-of-order calls, errors,
malformed data, and independent instances.

## Files and data flow

- `guest/src/lib.rs`: async WIT implementation and a pending counter for display.
- `guest/build.rs`: tracks canonical WIT changes for Cargo rebuilds.
- `@druid-ui/build`: resolves `@druid-ui/client/wit`, invokes Cargo, wraps the
  core module with JCO, and atomically replaces `public/client/index.wasm`.
- `src/view.openui`: the authored document; `src/App.tsx` registers host tools.

Bindings are generated in Rust by `wit-bindgen`, using the canonical WIT shipped
by `@druid-ui/client`; there is no copied WIT or generated source checked in.
`Cargo.lock` is retained for reproducible dependencies. After editing Rust/WIT,
the shared Vite plugin rebuilds the guest and reloads the page. An explicit
`npm run build:guest --workspace=druid-rust-example` is also available.
React and document changes use Vite's normal development workflow.

Rust uses `host::call(...).await` and writes the result to the action's field.
`wit-bindgen` supplies native Component Model async bindings and guest scheduling;
there are no request IDs, completion exports, or application-managed callback maps.
The host runtime owns instance cancellation and suppresses stale state writes on
reload/unmount. QuickJS is only needed for TypeScript guests, not this Rust binary.

The [`wasm32-unknown-unknown` target](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html)
avoids implicit WASI imports. This example has no ambient filesystem, HTTP,
threading, or stdout capabilities; I/O and logging use explicit SDK imports.
See the [`wit-bindgen` macro documentation](https://docs.rs/wit-bindgen/latest/wit_bindgen/macro.generate.html)
for the binding/export model. No `cargo-component` installation is needed.
