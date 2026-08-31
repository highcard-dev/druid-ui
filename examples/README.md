# Druid UI Examples

This directory contains various examples demonstrating different features and use cases of Druid UI.

## 📚 Examples Overview

### Basic Examples

#### [starter](./starter/)

**Minimal template for new projects**

- Auto-switches between dev (no-sandbox) and prod (WASM) modes
- Clean starting point for new applications
- Best for: Starting new projects

#### [simple](./simple/)

**Basic example with WASM sandbox**

- Component composition (functional & class-based)
- Event handling and state management
- Client-side routing
- Best for: Understanding core concepts with security

#### [simple-no-sandbox](./simple-no-sandbox/)

**Same as simple, but without WASM**

- Faster development iteration
- Demonstrates hook lifecycle
- Shows HMR reload behavior with generation tracking
- Best for: Rapid development and debugging

### Extended Examples

#### [simple-extended](./simple-extended/)

**WASM example with custom host functions**

- Extension API integration
- Async host function calls
- Shows how to extend Druid UI capabilities
- Best for: Building applications with custom platform APIs

#### [simple-extended-no-sandbox](./simple-extended-no-sandbox/)

**Extended features without WASM**

- Same extension API as simple-extended
- Faster iteration during development
- Best for: Developing with custom extensions

### Platform Examples

#### [druid-plattform](./druid-plattform/)

**Full platform integration**

- Complete extension API
- HTTP requests, file system operations
- Shows how to build a full application platform
- Best for: Reference implementation for complex platforms

#### [druid-plattform-no-sandbox](./druid-plattform-no-sandbox/)

**Platform example in no-sandbox mode**

- Same features as druid-plattform
- No WASM for faster development
- Best for: Platform development iteration

## 🚀 Quick Start

### Run an example

```bash
cd examples/starter
npm install
npm run dev
```

### Build an example

```bash
npm run build
```

## 📖 Key Concepts

### Sandbox vs No-Sandbox

**Sandbox Mode (WASM)**

- ✅ Secure execution environment
- ✅ Component isolation
- ⏱️ Slower development iteration
- 📦 Requires WASM compilation

**No-Sandbox Mode (Raw JS)**

- ✅ Faster development
- ✅ Direct JavaScript execution
- ✅ Better debugging
- ⚠️ No isolation

### Extension API

Examples demonstrate how to extend Druid UI with custom functions:

```typescript
druidUiElement.extensionObject = {
  "druid:ui/extension": {
    customFunction: PromiseToResult(async (arg: string) => {
      // Your custom logic
      return result;
    }),
  },
};
```

### Hot Module Replacement (HMR)

All examples include HMR support for instant updates during development:

```typescript
import { ViteHMR } from "@druid-ui/vite/client";
ViteHMR(druidUiElement);
```

The no-sandbox examples also demonstrate proper HMR reload behavior with:

- Generation tracking to prevent race conditions
- Hook reinitialization on each reload
- Proper cleanup of pending operations

## 🎯 Choosing an Example

| Goal                  | Recommended Example             |
| --------------------- | ------------------------------- |
| Start a new project   | `starter`                       |
| Learn the basics      | `simple` or `simple-no-sandbox` |
| Add custom APIs       | `simple-extended`               |
| Build a platform      | `druid-plattform`               |
| Fast development      | Any `-no-sandbox` variant       |
| Production deployment | Any WASM variant                |

## 📝 Example Structure

Each example follows this structure:

```
example-name/
├── index.html          # Entry HTML
├── src/
│   ├── main.ts        # Setup and configuration
│   └── component/     # Your components
├── public/            # Static assets & bundles
├── package.json
├── vite.config.ts
└── README.md          # Example-specific docs
```

## 🔧 Development Tips

1. **Start with no-sandbox** for faster iteration
2. **Test with WASM** before deploying to catch security issues
3. **Use HMR** for instant feedback
4. **Check console logs** for debug output (enabled in current build)
5. **Monitor generation tracking** in no-sandbox mode to understand reload behavior

## 📚 Documentation

- [Main README](../README.md)
- [Component API](../packages/component/)
- [Host API](../packages/host/)
- [Build Tools](../packages/build/)
