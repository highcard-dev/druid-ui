# Druid UI Guide For AI Assistants

This is a Druid UI project. Druid UI is a WebAssembly-first UI framework for hosting user-provided components safely. It uses JSX/TSX for authoring, but it is not React.

## Core Concepts

- Component code runs as a Druid UI guest component.
- Host code creates and configures a `DruidUI` custom element from `@druid-ui/host`.
- JSX is compiled through `@druid-ui/component`; do not add React imports, React hooks, or React DOM APIs.
- A component exports `component = createComponent(...)` from `@druid-ui/component`.
- Component render functions return JSX or a Druid UI node id.
- Component state is usually stored in module-level variables.
- Every event handler execution ends with a rerender. Druid UI rerenders the whole component tree rather than using React-style state reconciliation.
- Sandboxed components cannot use arbitrary browser APIs. Host capabilities must be explicitly exposed through Druid UI extensions.

## Creating A Component

Create a TSX file and export a Druid UI component:

```tsx
import { type Context, type Event, createComponent } from "@druid-ui/component";

let count = 0;

export const component = createComponent((ctx: Context) => {
  return (
    <main>
      <h1>Hello from Druid UI</h1>
      <p>Path: {ctx.path}</p>
      <button
        onClick={(event: Event) => {
          count++;
        }}
      >
        Clicked {count} times
      </button>
    </main>
  );
});
```

Important rules:

- Import `createComponent`, `Context`, `Event`, and `log` from `@druid-ui/component`.
- Do not import from `react`.
- Do not use `useState`, `useEffect`, `useMemo`, or other React hooks.
- Store simple mutable UI state in module-level variables.
- Event handlers may mutate module-level state; Druid UI rerenders after the handler runs.
- Keep browser-only APIs out of sandboxed component code unless a host extension provides them.

## Creating And Using Child Components

Reusable components are plain functions that return JSX. Use them like JSX tags inside the root `createComponent` render function.

```tsx
import { type Context, createComponent } from "@druid-ui/component";

type CardProps = {
  title: string;
  children?: string | JSX.Element | Array<string | JSX.Element>;
};

const Card = ({ title, children }: CardProps) => {
  return (
    <section>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
};

const Greeting = ({ name }: { name: string }) => {
  return <p>Hello {name}</p>;
};

export const component = createComponent((ctx: Context) => {
  return (
    <main>
      <Card title="User">
        <Greeting name="Druid UI" />
      </Card>
    </main>
  );
});
```

Child component rules:

- Define reusable UI as plain functions, not React components with hooks.
- Pass data through props like normal JSX.
- Keep shared mutable state at module scope or pass values down as props.
- Event handlers can be passed as props and attached to DOM elements inside child components.
- Child components should return one JSX node or string-like render output.
- Only the exported `component = createComponent(...)` is the Druid UI entry point; child components are implementation details.

## Hosting A Component

In a full app template, `src/main.ts` creates the host element and points it at the built component artifact:

```ts
import { DruidUI } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

const druidUiElement = new DruidUI();

if (import.meta.env.DEV) {
  druidUiElement.sandbox = false;
  druidUiElement.setAttribute("entrypoint", "/app.bundled-raw.js");
} else {
  druidUiElement.setAttribute("entrypoint", "/app.wasm");
}

document.getElementById("app")?.appendChild(druidUiElement);
ViteHMR(druidUiElement);
```

Modes:

- Sandbox mode loads a `.wasm` component and isolates guest code.
- No-sandbox mode loads a raw JavaScript bundle and is faster for local development.
- Prefer no-sandbox mode while editing, then validate behavior in sandbox mode before production.

## Build Commands

Use the scripts in `package.json`; common commands are:

- `npm run dev` starts local development.
- `npm run build` builds the sandboxed WASM artifact.
- `npm run build:raw` builds the raw JavaScript artifact when available.

Direct build examples:

```bash
druid-ui-build src/component/app.tsx dist
druid-ui-build src/component/app.tsx dist --raw
```

## Extensions And Host APIs

Druid UI components only receive APIs the host explicitly provides. Add host APIs with WIT and `extensionObject`.

Host side:

```ts
import { DruidUI, PromiseToResult } from "@druid-ui/host";

const druidUiElement = new DruidUI();

druidUiElement.extensionObject = {
  "druid:ui/extension": {
    requestGet: PromiseToResult(async (url: string) => {
      const res = await fetch(url);
      return res.text();
    }),
  },
};
```

Component side:

- Define imported functions in a `.wit` file.
- Generate or use TypeScript wrappers for those imports.
- Await async host APIs from event handlers or helper functions.
- Keep WIT names, TypeScript wrapper names, and `extensionObject` keys in sync.

Platform examples use the `"druid:ui/plattform"` extension and `@druid-ui/plattform` helpers such as `request`, `loadFileFromDeployment`, and `saveFileToDeployment`.

## Common Pitfalls

- Do not treat TSX as React. JSX here creates Druid UI nodes.
- Do not use React component lifecycle patterns.
- Do not put secret or privileged logic into guest component code.
- Do not call browser APIs from sandboxed components unless exposed by the host.
- Do not forget to keep WIT files and generated TypeScript types in sync after changing extension APIs.
- Do not assume no-sandbox behavior is equivalent to sandbox behavior for security or host API access.
