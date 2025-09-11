# DruidUI

A JavaScript UI library that allows you to build interactive web applications using Lua scripts. Available as both a library with external dependencies and a fully self-contained bundle.

## Installation

### NPM Package (Library Version)

```bash
npm install druid-ui
```

This installs the library version that requires external dependencies to be installed separately.

### Self-Contained Bundle

For direct browser usage without a build system:

```html
<!-- ES Module (Standalone) -->
<script type="module">
  import { DruidUI } from "https://unpkg.com/druid-ui/dist/druid-ui.standalone.esm.js";
  // Your code here
</script>

<!-- UMD (Standalone) -->
<script src="https://unpkg.com/druid-ui/dist/druid-ui.standalone.umd.js"></script>
<script>
  // DruidUI is available globally
  const { DruidUI } = window.DruidUI;
</script>
```

## Usage

### Library Version (with external dependencies)

```javascript
import { DruidUI } from "druid-ui";
// Dependencies like wasmoon, morphdom, @twind/* need to be installed separately
```

### Standalone Version (all dependencies bundled)

```javascript
import { DruidUI } from "druid-ui/standalone";
// Everything is bundled, no external dependencies needed
```

### As a Web Component

```html
<!DOCTYPE html>
<html>
  <head>
    <title>DruidUI Example</title>
  </head>
  <body>
    <druid-ui entrypoint="app.lua" path="/"></druid-ui>

    <script type="module">
      import { DruidUI } from "druid-ui/standalone";
      // DruidUI is automatically registered as a custom element
    </script>
  </body>
</html>
```

### Programmatically

```javascript
import { DruidUI } from "druid-ui";

const druidElement = document.createElement("druid-ui");
druidElement.setAttribute("entrypoint", "app.lua");
druidElement.setAttribute("path", "/");

document.body.appendChild(druidElement);
```

## Building

### Development Build

```bash
npm run dev
```

### Production Build (Both Versions)

```bash
npm run build
```

This creates both library and standalone versions:

#### Library Version (external dependencies)

- `dist/druid-ui.lib.esm.js` - ES Module
- `dist/druid-ui.lib.umd.js` - UMD build
- `dist/main.d.ts` - TypeScript definitions

#### Standalone Version (bundled dependencies)

- `dist/druid-ui.standalone.esm.js` - ES Module with all dependencies
- `dist/druid-ui.standalone.umd.js` - UMD build with all dependencies

### Individual Builds

```bash
# Build only the library version (with external deps)
npm run build:lib

# Build only the standalone version (bundled deps)
npm run build:standalone
```
