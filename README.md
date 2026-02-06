# DruidUI - A WebAssembly SPA Framework

This is DruidUI. It is a frontend Web Framework based on WebAssembly. It makes it easy to write React-like components, that build into WASM.
This framework makes heavy use of the [Component Model](https://component-model.bytecodealliance.org/).

## Why?

DruidUI is mainly developed for scenarios where you want to support user-generated content/UIs on your platform and thus want to sandbox any execution.
WebAssembly is a great use case for that, as it encapsulates any run code fully. Only functions that are explicitly forwarded to the WASM target, can be executed.

## Quick Start

```bash
npx -p druid-ui create-druid-ui my-app
cd my-app
npm run build
```

This scaffolds a new project with `druid-ui` as a dependency, a pre-configured `tsconfig.json`, and an empty `src/index.tsx` entry point.

## Installation

```bash
npm i druid-ui
```

### Getting Started

This is a very simple component, using JSX/TSX. Other languages are not officially supported yet. Thus DX for them is not so fancy.

```jsx
const ComponentTitle = ({ title, description }: ComponentTitle) => (
  <div>
    <h1>{title}</h1>
    <h2>{description}</h2>
  </div>
);

export const component = createComponent((ctx: Context) => {
  log(`Render with path: ${ctx.path}`);
  return (
    <main>
      <ComponentTitle
        title="Hello World"
        description="Just a simple component"
      />
      <button
        onClick={() => {
          i++;
        }}
      >
        click me
      </button>
      <hr />
      <b>Clicks: </b> {i}
    </main>
  );
});
```

## Principles

DruidUI is very inspired by the simplicity of [MithrilJS](https://mithril.js.org/).
It does not have a very complex rerender pipeline like [React](https://react.dev), where you have a relatively high complexity in determining the conditions, when and what to rerender.
In DruidUI **every event listener execution ends with a rerender**, additionally rerender can also be executed manually. **A rerender always rerenders everything.**
This is obviously not as efficient as React, but makes it very intuitive to build components in different languages.
For rendering nodes to html elements, DruidUI uses the library [Snabbdom](https://github.com/snabbdom/snabbdom).

DruidUI uses [WebComponents](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) and ShadowDOM for additional encapsulation.

DruidUI only forwards the following functions to the guest:

```ts
d(element: string, props: {on: {key: string, fn: string} props: {key: string, value: string}}[], children: string[]): string
log(string)
rerender()
```

DruidUI expects the following functions back from it's components

```ts
emit(fnId: string, event: Event) # run previously registered event listener
init(): string # entry point, returns JSX node id
asncCallback(fnId: string, val: string): # hack to support async functions, will be removed when WASI Preview 3 is supported
```

## Multi Language Support

Currently the only officially supported language is [JavaScript](https://component-model.bytecodealliance.org/language-support/building-a-simple-component/javascript.html). There is some additional tooling included, so that the DX is nice.
It supports JSX/TSX and it includes some wrapper functions around the functions, defined by the [WIT files](https://component-model.bytecodealliance.org/design/wit.html).
In theory it should be straight forward to use any other language like [Rust](https://component-model.bytecodealliance.org/language-support/building-a-simple-component/rust.html), [C or C++](https://component-model.bytecodealliance.org/language-support/building-a-simple-component/c.html), which is supported by the [Component Model](https://component-model.bytecodealliance.org/), but this is not tested yet.
Feel free to [create a PR](https://github.com/highcard-dev/druid-ui/pulls). We plan to support this later. Currently [Component Model](https://component-model.bytecodealliance.org/) is not super stable yet and there are some missing features, sothat we want to wait, before investing in SDKs, where the API will change, as soon as more WASI features are widely available (especially async support).

Especially features like [concurrency](https://component-model.bytecodealliance.org/building-a-simple-component.html), [client callbacks](https://github.com/WebAssembly/component-model/issues/223) and [recursive types](https://github.com/WebAssembly/component-model/issues/56) are missing at this point, which would make things easier and the support of multiple languages more straight forward.

## Extensions

As previously stated, by default we only export very few functions to the WASM guest. This is usually not enough.
Thus DruidUI supports [Extensions](#extensions). You can build your own [WIT file](https://component-model.bytecodealliance.org/design/wit.html) and define your own [world](https://component-model.bytecodealliance.org/design/wit.html#wit-worlds), to basically pass whatever you want to your guest.
You can easily pass the functions via:

```js
druidUiElement.extensionObject = {
  "druid:ui/extension": {
    customFunction: () => {
      console.log("customFunction called");
    },
  },
};
```

Please checkout the [example](./examples/simple-extended) for a full implementation. It also includes a workaround to make [async functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) work. This is pretty ugly, but will be removed as soon as [WASI Preview 3](https://github.com/WebAssembly/WASI/blob/main/wasip3/README.md) is stable enough to be used.

## Sandbox Mode

By default DruidUI makes use of WASM to build a sandbox for the component. This is the main reason it exists,
but there are some reasons where you (temporarily) want to disable the WASM sandbox. This can be done by setting the `no-sandbox` HTML attribute or by calling `druidElement.sandbox = false`.
This is especially useful if you want to develop components.
In theory you don't need it, but build times and resource consumption for such things is quite high, so it is recommended to disable it while not being in production.

## Vite Plugin

There is a [Vite Plugin](./src/dev), to make hot reloading work nicely. It supports both [sandbox mode](#sandbox-mode) and non-sandbox mode (also called `Raw Mode`).
Check out the [Example for sandboxed development](./examples/simple) and [example for non-sandboxed mode](./examples/simple-no-sandbox).

## CLI

There are two useful commands, which you can easily run with npx:

```bash
npx build-ui <file>  # build current component
npx gen-types        # generates types for your extension
```

## Examples

- [Simple Example](./examples/simple) - Basic component in sandbox mode
- [Simple Extended Example](./examples/simple-extended) - Component with custom extensions
- [Simple No-Sandbox Example](./examples/simple-no-sandbox) - Development without WASM overhead
- [Simple Extended No-Sandbox Example](./examples/simple-extended-no-sandbox) - Extended component in raw mode
