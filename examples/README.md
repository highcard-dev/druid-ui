# Examples

These examples retain the useful legacy use cases, refactored onto authored
OpenUI views, React hosts, WASM clients, and explicitly registered tools.
Starters prefer Rust guests; focused TypeScript examples remain to demonstrate
the supported QuickJS guest path. React hosts remain TypeScript in both cases.

| Example                                                    | Demonstrates                                                           | Workspace                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| [starter](starter)                                         | Settings form, custom WASM action, async tools, save/reset             | `druid-openui-starter`          |
| [simple](simple)                                           | Composition, counter state, conditional rendering, client-side routing | `druid-example-simple`          |
| [simple-extended](simple-extended)                         | Async HTTP, loading/error states, recovery, host URL policy            | `druid-example-simple-extended` |
| [druid-plattform](druid-plattform)                         | File read/write, configuration editing, HTTP, custom React component   | `druid-example-druid-plattform` |
| [starter-component](starter-component)                     | Minimal guest-only WASM/document build                                 | `druid-client-starter`          |
| [starter-component-plattform](starter-component-plattform) | Guest-only file and HTTP tool calls for embedding                      | `druid-client-tools-starter`    |
| [custom-wit](custom-wit)                                   | Custom WIT world and direct synchronous typed imports                  | `druid-custom-wit-starter`      |
| [rust-client](rust-client)                                 | Rust guest, counter, native async host tools                           | `druid-rust-example`            |

```sh
npm ci
npm run build
npm run dev --workspace=druid-example-simple
```

The [Rust client](rust-client) adds a Rust guest with a counter, async host-tool
calls through native async WIT (`druid-rust-example`). It uses the same
React/OpenUI host and canonical WIT as the TypeScript examples.

`npm run build:examples` discovers and builds every example sequentially. Guest-only
examples use `npm run dev` to watch/build artifacts; they do not start a web server.
All examples use SDK package exports. Development and production both use real WASM.

Building all examples requires Rust/Cargo and the `wasm32-unknown-unknown`
target for the Rust starters. `npm run test:rust` executes all Rust guests through
real WASM; `npm test` remains the JavaScript/TypeScript SDK test suite.

The scaffolder ships `starter`, `custom-wit`, and `starter-component` (under its
existing CLI template name `starter-client`). Other examples are focused references,
not duplicate scaffold templates.

## What was intentionally retired?

The `*-no-sandbox` variants stay removed: raw JavaScript execution, old DOM hooks,
and generation-tracking reload code no longer exist. Their useful file/config
editing behavior is retained in `druid-plattform`. Functional/class-based guest
JSX components are replaced by document composition and optional React components
in the trusted host.

The historical `plattform` directory names remain for discoverability, but these
examples do not import the retired platform package. File storage is page-local
memory, HTTP is restricted to local demo fixtures, and no deployment/backend is used.
