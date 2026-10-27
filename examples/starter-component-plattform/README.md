# Rust guest-only host-tool integration

Requires stable Rust/Cargo and the `wasm32-unknown-unknown` target. After the root SDK build, run:

```sh
npm run build --workspace=druid-client-tools-starter
npm run dev --workspace=druid-client-tools-starter
```

Build emits `dist/index.wasm` and `dist/index.openui`; dev watches the Rust guest
in `guest/src/lib.rs`, Cargo inputs and SDK WIT. Keep `guest/Cargo.lock`.
There is no browser application in this example. An embedding React host loads
these artifacts, defines the `ReadFile`, `WriteFile` (string `content` parameter),
and `FetchStatus` actions, and registers these tools:

| Tool         | Params                                           | Result               |
| ------------ | ------------------------------------------------ | -------------------- |
| `file_read`  | `{ path: "server.properties" }`                  | File text            |
| `file_write` | `{ path: "server.properties", content: string }` | JSON acknowledgement |
| `http_get`   | `{ path: "status.json" }`                        | JSON status          |

The matching host implementation is in `../druid-plattform/src/tools.ts`.
Read updates the displayed text; write sends that text back to the host; fetch
shows the status. Errors are displayed without retries. The host, not the guest,
owns authorization, deployment scoping, persistence, and confirmation policies.

The historical directory name remains; the retired platform package is not used.
