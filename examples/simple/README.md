# Counter and routing

```sh
npm run build
npm run dev --workspace=druid-example-simple
```

Run those commands from the repository root. The authored document composes a
header, counter, conditional milestone, and test page. WASM owns the counter and
dispatches `Navigate` through allowlisted `get_location`/`navigate` host tools.

Click six times, visit the test page, and return: the current instance retains
its counter. Browser Back/Forward reloads the guest at the current route and
resets its counter. Direct visits to `/test` are supported by Vite's app fallback.
Unknown routes show a return button; the host rejects arbitrary navigation URLs.

This replaces guest JSX composition and `ctx.path` with OpenUI composition and
explicit host-owned routing. Development runs the same WASM flow as production.
