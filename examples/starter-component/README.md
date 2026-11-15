# Rust guest-only starter

This is the refactored `starter-component` example. The scaffolder also ships it
under the CLI template name `starter-client`.

The Rust guest can build without Node/npm. Install stable Rust/Cargo, run
`rustup target add wasm32-unknown-unknown` and
`cargo install --locked wasm-tools --version 1.262.0`, then from this SDK checkout:

```sh
../../packages/client/build-rust.sh guest/Cargo.toml dist --name=index --document=src/view.openui
```

Generated projects include `build.sh` and `wit/` locally, so use
`./build.sh` there instead. Edit `guest/src/lib.rs` and keep Cargo.lock.
Node 24+ is only needed for the optional npm build/watch workflow:
`npm run build` emits `dist/index.wasm` and `dist/index.openui`.
`npm run dev` watches Rust, Cargo and SDK WIT inputs. A host must define the `LoadMessage` action
and register a `load_message` tool. This template contains no browser application.
Rust awaits the tool directly and writes its JSON result or an error to `$message`.
The npm wrapper resolves WIT from the installed SDK; the standalone builder uses
the checked-in WIT snapshot. Keep it aligned with the host SDK contract.
