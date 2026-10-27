# OpenUI + Rust WASM starter

Requires Node 24+, stable Rust/Cargo, `rustup target add wasm32-unknown-unknown`,
and a JSPI-capable browser. Run `npm install` and `npm run dev`. The Vite plugin
builds and watches `guest/src/lib.rs`, Cargo inputs, and canonical SDK WIT.
Edit server settings and click Preview: WASM awaits a host tool and updates the
reactive preview text. A server name of `fail` demonstrates tool rejection.
Save uses OpenUI's mutation tool; Reset restores the form and preview text.
Everything is in memory. Production output is built with `npm run build`.
The React host remains TypeScript. Rust uses `host::call(...).await` and JSON
state imports; keep `guest/Cargo.lock` for reproducible builds.
