# Rust guest-only starter

This is the refactored `starter-component` example. The scaffolder also ships it
under the CLI template name `starter-client`.

Requires Node 24+, stable Rust/Cargo and `rustup target add wasm32-unknown-unknown`.
Edit `guest/src/lib.rs`; `npm run build` emits `dist/index.wasm` and `dist/index.openui`.
`npm run dev` watches Rust, Cargo and SDK WIT inputs. A host must define the `LoadMessage` action
and register a `load_message` tool. This template contains no browser application.
Rust awaits the tool directly and writes its JSON result or an error to `$message`.
Keep `guest/Cargo.lock`; WIT is resolved from the installed SDK at build time.
