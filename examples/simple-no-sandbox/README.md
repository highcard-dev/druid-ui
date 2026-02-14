# Simple Example (No Sandbox)

Same as the simple example, but running without WASM sandbox for faster development.

## Features

- ✅ Direct JavaScript execution (faster iteration)
- ✅ Component hooks (init lifecycle)
- ✅ Hook reinitialization on HMR reload
- ✅ Event handling with state
- ✅ Client-side routing
- ✅ Hot Module Replacement with generation tracking

## Run

```bash
npm run dev
```

## Build

```bash
npm run build
```

The component runs as bundled JavaScript (`simple.bundled-raw.js`) without WASM compilation.

## Use Case

Ideal for rapid development when you don't need sandboxing. Demonstrates hook lifecycle with proper HMR reload behavior.
