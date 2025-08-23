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

## Features

- **Dual distribution**: Library version for bundlers, standalone for direct browser use
- **TypeScript support**: Full TypeScript definitions included
- **Web Components**: Works as a standard custom element
- **Lua scripting**: Build UI with Lua scripts
- **Modern build**: ES modules and UMD formats available

## Bundle Sizes

- **Library version**: Smaller, requires external dependencies
- **Standalone version**: Larger but includes everything needed

Choose the library version if you're using a bundler and want to control dependencies. Choose the standalone version for direct browser usage or if you want everything in one file.

## Publishing

This package uses **semantic versioning** with automated releases. Every commit to the main/master branch triggers an automatic version bump and release based on your commit message.

### Setup

1. **Create an npm token**: Go to [npmjs.com](https://www.npmjs.com) → Account Settings → Access Tokens → Generate New Token (Automation type)

2. **Add the token to GitHub**: In your repository, go to Settings → Secrets and variables → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Value: Your npm token

### Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning:

```bash
# Patch release (0.1.0 → 0.1.1)
git commit -m "fix: resolve memory leak in Lua execution"

# Minor release (0.1.0 → 0.2.0)
git commit -m "feat: add new component system"

# Major release (0.1.0 → 1.0.0)
git commit -m "feat!: redesign core API"
```

See [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) for detailed guidelines.

### Automatic Release Process

When you push to main/master:

1. **Semantic-release** analyzes your commit messages
2. **Automatically determines** the appropriate version bump
3. **Updates** `package.json` and `CHANGELOG.md`
4. **Creates** a GitHub release with release notes
5. **Publishes** to npm with the new version

### Manual Publishing (Emergency Only)

If you need to publish manually:

1. Go to the Actions tab in your GitHub repository
2. Select "Manual Publish" workflow
3. Click "Run workflow"
4. Enter the version number you want to publish

### Automated Checks

- **CI Workflow**: Runs on every push/PR to main branch

  - Tests the build process
  - Validates package contents
  - Tests on Node.js 18 and 20

- **Release Workflow**: Runs on every push to main/master
  - Builds the package
  - Runs tests (if available)
  - Automatically versions and publishes based on commit messages

## License

MIT
