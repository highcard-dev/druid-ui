# Async HTTP from WASM

After the root SDK build, run `npm run dev --workspace=druid-example-simple-extended`.
Click Fetch JSON to load `message.json`. Change the resource to `missing.json`
to exercise an HTTP failure, then change it back to verify recovery.

The guest awaits `callTool("http_get", { path })`; the host performs fetch with
the instance cancellation signal and returns JSON or an error through the SDK.
The trusted handler exposes only these two local fixture names. No external
service, credentials, backend, or automatic retries are involved.

This replaces the old Promise-to-result extension adapter. For custom synchronous
WIT imports rather than async host I/O, see `../custom-wit`.
