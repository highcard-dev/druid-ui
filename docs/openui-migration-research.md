# OpenUI migration feasibility

Research date: 2026-10-27. Scope: replace Druid UI's view/runtime machinery as far as practical, retaining deployment functionality and portable WASM behavior. Research only; no migration, release, merge, or deployment performed.

## Recommendation

**Yes: OpenUI Lang + the OpenUI React renderer + a small trusted Druid capability host + optional WASM behavior is viable. No: OpenUI Lang and a WASM event function alone cannot replace the browser renderer, authentication, file transport, or application policy.** This is an architectural recommendation/inference from the interfaces below, not an upstream-supported Druid integration.

For settings editors, use authored, versioned OpenUI Lang documents—not an LLM on the execution path. Keep ordinary input state in OpenUI; invoke WASM only for domain transformations, validation, serialization, and operations. Some simple Scrolls could need no custom WASM at all if the host already supplies their necessary tools. Avoid rebuilding another UI framework around the bridge.

## Which OpenUI?

The relevant project is **Thesys `thesysdev/openui`**, which owns OpenUI Lang and the `@openuidev/*` packages. It is not [W&B's HTML/UI-generation application](https://github.com/wandb/openui), nor the [W3C Open UI controls community group](https://open-ui.org/). [Upstream repository](https://github.com/thesysdev/openui)

Source inspection is pinned to commit [`f08a660535e55b5b2a24a0eb68568edaf9e4fe4b`](https://github.com/thesysdev/openui/commit/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b), dated 2026-10-27. Its manifests declare `@openuidev/react-lang` and `lang-core` **1.0.2**, and `react-ui` **0.18.1**; these are repository versions, not a verified npm-install compatibility result. [React runtime manifest](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-lang/package.json), [core manifest](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/lang-core/package.json), [component-library manifest](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-ui/package.json).

## What it already supplies

| Need | Upstream facility | Druid implication / assessment |
| --- | --- | --- |
| Render authored UI | `Renderer` accepts a text `response`, a library, and `isStreaming=false`; no model or hosted service is a prerequisite | Commit/release a static Lang document with the Scroll. Authoring deterministically is an inference from this API, not a separate advertised static-app product. [Overview](https://www.openui.com/docs/openui-lang/overview), [renderer](https://www.openui.com/docs/openui-lang/renderer) |
| Inputs and local conditional UI | `$variables`, two-way reactive bindings, expressions, `@Set`, `@Reset` | OpenUI can own normal edit fields, tabs, filters, and visibility without guest round-trips per keystroke. [Reactive state](https://www.openui.com/docs/openui-lang/reactive-state) |
| Async reads and writes | `Query`, `Mutation`, async function-map `toolProvider`; mutations run on `@Run`, not mount | Route these functions to the existing trusted deployment APIs or a WASM adapter. No MCP server is required. [Queries and mutations](https://www.openui.com/docs/openui-lang/queries-mutations) |
| Custom behavior | `defineAction` and typed `onAction` events; `defineFunction` for pure synchronous calculations | Action names can map to WASM exports. Functions are not for IO or async saves. [Actions](https://www.openui.com/docs/openui-lang/actions), [1.0 specification](https://www.openui.com/docs/openui-lang/specification) |
| Design system / special widgets | Zod component contracts and React renderers; `library.extend` adds, overrides, or removes components | Start with stock controls; keep only actual gaps such as a code editor or live terminal as host components. [Defining components](https://www.openui.com/docs/openui-lang/defining-components), [1.0 changes](https://www.openui.com/docs/openui-lang/whats-new) |
| Persist edit state | `initialState` hydration plus `onStateUpdate` snapshots | Persistence still belongs to Druid. Do not confuse this with saving game configuration files. [Interactivity](https://www.openui.com/docs/openui-lang/interactivity) |

## Proposed minimal shape

This is a proposed Druid design, not an existing OpenUI WASM plugin API:

```text
Scroll: authored view.openui + optional behavior.wasm + configuration metadata
                         |
                  Druid browser host
                         |
           OpenUI Renderer + approved component library
              |                           |
       $local form state           Query / Mutation / custom action
                                          |
                              narrow JS <-> WASM adapter
                                          |
                              trusted capability dispatcher
                                          |
                         existing file and deployment APIs
```

Suggested adapter responsibilities: load/instantiate one guest, serialize bounded structured arguments/results, correlate asynchronous requests, propagate errors, and dispose it when the deployment/page changes. The trusted dispatcher supplies deployment context itself; guest-provided deployment IDs or file paths must not become authority. Preserve existing run/stop/external-request confirmations and server authorization. Explicitly define the policy for file writes; the inspected Druid host does not currently confirm every file save.

Do **not** transport a virtual DOM, DOM node IDs, JSX callbacks, CSS patches, or React components across this boundary. The WASM guest should return domain data/results, not another component tree unless a genuinely dynamic layout requires an updated Lang document. This avoids keeping both the old renderer and a new one.

## Important implementation traps

### 1. Custom actions are not awaited operations

The React implementation types `onAction` as returning `void` and dispatches custom actions by calling `handler?.(...)` without awaiting. In contrast, `@Run` on a mutation awaits `queryManager.fireMutation`; failure halts the remaining action steps. A Query refetch is invalidated but not awaited to completion. Therefore, do not use `Action([@SaveViaWasm(...), @Restart(...)])` and assume save finishes first. Use `Mutation("save_and_restart", ...)` with one host/WASM operation, or explicit awaited mutation steps. [Renderer props](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-lang/src/Renderer.tsx), [action execution](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-lang/src/hooks/useOpenUIState.ts).

### 2. Choose one state owner

`initialState` is not a simple controlled `value` prop. The hook re-applies changed hydration data; the store updates persisted keys, retains keys absent from the new data, and preserves dirty values against new declared defaults. Consequently, a WASM-to-OpenUI update protocol needs an explicit policy for dirty fields, reloads, and stale async results. Do not bounce every `onStateUpdate` snapshot into `initialState` without testing feedback and overwrite behavior. [State hook](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-lang/src/hooks/useOpenUIState.ts), [store initialization](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/lang-core/src/runtime/store.ts).

### 3. Polling is supported; full live transport is host work

`Query` can refresh on an interval. The inspected manager uses Promise-returning tools, timers, and cache invalidation; it has no first-class WebSocket/SSE subscription interface. It also does not pass an `AbortSignal` to tools. Live logs/terminal streams, reconnection, cancellation, and guest teardown remain host responsibilities; a registered React component can handle a genuinely streaming widget. Late/stale responses must not write to another deployment. [Query manager](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/lang-core/src/runtime/queryManager.ts).

### 4. No built-in Druid/WASM bridge was found

The reviewed public renderer interfaces accept JavaScript components, action handlers, and Promise-returning tools—not a WASM artifact or WIT world. A custom adapter is necessary. Browser WebAssembly supports importing host functions and calling exported functions, so this bridge is feasible; existing Component Model guests still need their existing compatible loading/glue layer unless rewritten. [Renderer API source](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-lang/src/Renderer.tsx), [WebAssembly JavaScript API specification](https://www.w3.org/TR/wasm-js-api-2/).

OpenUI itself now uses a TypeScript parser, after replacing its Rust/WASM parser. That is unrelated to using WASM for Druid behavior. Do not interpret OpenUI's former WASM parser as native support for WASM application handlers. Their performance results are their own parser workload, not a Druid benchmark. [First-party engineering account](https://www.openui.com/blog/rust-wasm-parser).

### 5. A declarative format is not authorization

The evaluator processes a restricted expression AST, looks up registered functions, and maps component names to registered renderers. This is not arbitrary JavaScript supplied in ordinary Lang text, but registered JavaScript components/functions still run with host privileges. [Evaluator implementation](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/lang-core/src/runtime/evaluator.ts).

Restricted action slots are currently schema/prompt guidance, **not enforced runtime action allowlists**. A WASM sandbox can access the APIs its host grants, so retain an independently enforced capability allowlist. Validate operation inputs, constrain paths and URLs, and keep credentials outside guest state/documents. Cap document size, results, WASM memory/work, and event frequency; consider worker isolation if third-party behavior must not block the UI. These are design recommendations, not an upstream security certification. [Action-slot caveat](https://www.openui.com/docs/openui-lang/actions), [WebAssembly security model](https://webassembly.org/docs/security/).

**Concrete consequence:** `Query` and `Mutation` share the same `toolProvider` dispatch. An untrusted document can write `Query("save_config", ...)` for a name intended as a mutation; Query executes automatically after parsing settles. Calling a function a mutation or placing it behind a button is therefore **not** an authorization/user-gesture boundary. Authorize every host operation independently and require trusted-host confirmation for sensitive effects, including calls originating as Queries. Do not expose an unrestricted HTTP/file/command executor. [Shared provider dispatch](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-lang/src/Renderer.tsx), [query execution](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/lang-core/src/runtime/queryManager.ts).

## Maturity, licensing, and cost

The inspected repository is MIT licensed, with the normal notice-preservation requirement; this is not a claim that every transitive dependency has the same license. [License](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/LICENSE).

React has the relevant 1.0 custom action/function features. Vue/Svelte/Angular remain on 0.4 according to the current upgrade notes. Druid should therefore target the React renderer rather than assume equivalent support across adapters. Pin exact packages and your component-library contract because positional props depend on schema key order. [Upgrade notes](https://www.openui.com/docs/openui-lang/whats-new), [component schemas](https://www.openui.com/docs/openui-lang/defining-components).

No model-token or hosted Gateway cost is intrinsically necessary to render authored documents; optional generation/correction services are a separate adoption decision. Installation telemetry is on by default and can be disabled with `OPENUI_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1`; runtime telemetry is opt-in. [Overview](https://www.openui.com/docs/openui-lang/overview), [telemetry policy](https://www.openui.com/docs/openui-lang/telemetry).

Separate from that telemetry policy, `publishObservability` defaults to true in the inspected React hook. Streaming events can contain response text/errors and go to a shared in-process observability bus, whose inspected implementation has no network transport. A renderer mounted only with static content never starts that streaming lifecycle. Set `publishObservability={false}` explicitly if unused and audit any bus listeners/exporters. [Streaming hook](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-lang/src/hooks/useStreamingObservability.ts), [bus implementation](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/observability/src/observability.ts).

The web entry also auto-mounts development devtools; the bootstrap describes a CDN-loaded browser build. It is guarded by `NODE_ENV === "development"`, with production removal depending on the consumer's bundler. Therefore, "no required hosted generation service" must not be overstated as "zero external requests in every environment." Verify the bundled production application under a network deny-list before making an offline guarantee. [Development bootstrap](https://github.com/thesysdev/openui/blob/f08a660535e55b5b2a24a0eb68568edaf9e4fe4b/packages/react-lang/src/devtoolsBootstrap.ts).

## Proof required before deleting the old implementation

Recommended migration spike, not work performed in this research:

1. Pin the OpenUI runtime/library versions and create one deterministic Minecraft config-editor document.
2. Use stock inputs and actions for normal state; implement only `load_config`, `save_config`, and optional `restart` tools, backed by existing capabilities and domain serializers.
3. Demonstrate preservation of comments/unknown properties and existing validation, dirty drafts across file switches/query refreshes, file defaults, save/readback verification, error feedback, and user confirmations.
4. Test overlapping saves, double clicks, failed save before restart, deployment switching while loading, guest traps, non-terminating handlers, denied capabilities including malicious auto-executing Queries, invalid Lang, and empty/malformed files.
5. Test a second format (INI or XML), then a live status/log widget. Measure bundle/guest size, first render, per-input latency, and interop count against today's editor.
6. Only after parity, delete the superseded DOM/VDOM/WASM-view machinery; retain loaders/build glue only where the chosen WASM format actually requires them.

No end-to-end migration or clean dependency installation was executed for this report. Exact deletion counts, accessibility parity, live-stream integration, and performance are therefore unproven. The useful target is **one OpenUI view system plus a narrow capability/behavior adapter**, not zero Druid-specific runtime code.

## Mapping to the actual Druid implementation

Local inspection used Druid UI's reviewed source (equivalent to merged commit `0cbd087dc7e386b42b6107941b2282c895055fec`), the Monorepo feature implementation represented by PR head `34e5b65a90f5f7e35883f681506659e8a4277ff4`, and Scrolls head `00c8092a9ce73076805d75a6e4d4a551329b5d82`. The table separates observed responsibilities from proposed replacements; it is not a list of files already deleted.

| Current responsibility | Observed implementation | Proposed outcome |
| --- | --- | --- |
| Guest constructs a view; host reconstructs and patches DOM | `component.init` returns a node ID; `dfunc` stores nodes; host converts them to Snabbdom nodes and routes events back to `component.emit` | Replace with the OpenUI React renderer. Remove the custom node-map/VDOM rendering path after parity. [Host renderer](https://github.com/highcard-dev/druid-ui/blob/0cbd087dc7e386b42b6107941b2282c895055fec/packages/host/src/ui.ts#L400), [DOM bridge](https://github.com/highcard-dev/druid-ui/blob/0cbd087dc7e386b42b6107941b2282c895055fec/packages/host/src/host-functions.ts) |
| JSX lowering, guest callback IDs, whole-view rerenders | `createDFunc`, `callbackMap`, `createComponent`, and the guest's `emit` glue | Retire these for migrated views. Old WASM view binaries cannot become behavior-only modules without changing their contract. [Guest helpers](https://github.com/highcard-dev/druid-ui/blob/0cbd087dc7e386b42b6107941b2282c895055fec/packages/component/src/utils.ts) |
| Config-editor presentation | JSX controls, raw/form tabs, action bar, file rail, CSS | Rewrite view definitions in Lang using approved stock components. Register a trusted specialized editor component only if stock controls genuinely lack needed behavior. This replaces view code, not the editor's semantics. [Editor view/controller](https://github.com/highcard-dev/scrolls/blob/00c8092a9ce73076805d75a6e4d4a551329b5d82/ui/src/config-editor/components/EditorApp.tsx), [field controls](https://github.com/highcard-dev/scrolls/blob/00c8092a9ce73076805d75a6e4d4a551329b5d82/ui/src/config-editor/components/FieldControl.tsx) |
| Game-file semantics | Config schema, field validation/coercion, adapters for properties/INI/JSON/XML, original/working document and dirty/restart state | Retain the behavior and regression tests. It may live in a WASM module or trusted application code; OpenUI's form validation is not a game-file parser/serializer. [Store](https://github.com/highcard-dev/scrolls/blob/00c8092a9ce73076805d75a6e4d4a551329b5d82/ui/src/config-editor/store.ts), [formats/schema](https://github.com/highcard-dev/scrolls/blob/00c8092a9ce73076805d75a6e4d4a551329b5d82/ui/src/config-editor/model.ts), [adapters](https://github.com/highcard-dev/scrolls/tree/00c8092a9ce73076805d75a6e4d4a551329b5d82/ui/src/config-editor/adapters) |
| Async load/save lifecycle | Editor initializes the manifest, loads files, tracks status, validates serialized output, saves and verifies readback | Adapt to Query/Mutation or host-owned controller tools; preserve errors, save verification and drafts rather than regenerating/resetting the entire document after every operation. [File gateway](https://github.com/highcard-dev/scrolls/blob/00c8092a9ce73076805d75a6e4d4a551329b5d82/ui/src/config-editor/gateway.ts#L90), [app entry](https://github.com/highcard-dev/scrolls/blob/00c8092a9ce73076805d75a6e4d4a551329b5d82/ui/src/app.tsx) |
| Trusted deployment capabilities | SPA supplies file access, file-service startup, external-request confirmation and run/stop command confirmation through host functions | Keep and narrow this layer. Register scoped tools, not unrestricted access to JWTs, arbitrary deployments, URLs or files. [Host capabilities](https://github.com/highcard-dev/monorepo/blob/34e5b65a90f5f7e35883f681506659e8a4277ff4/apps/frontends/spa-app/src/components/dashboard/useDashboardExtensionFns.ts), [command authorization UX](https://github.com/highcard-dev/monorepo/blob/34e5b65a90f5f7e35883f681506659e8a4277ff4/apps/frontends/spa-app/src/utils/deployment-cluster/platform-command-controls.ts) |
| Loading, theme, navigation and bundle replacement | SPA downloads a package and supplies deployment context; it promotes a new host only after ready and keeps the previous UI if loading fails | Adapt these integration responsibilities, not necessarily the old custom element. OpenUI's renderer does not deploy or version a Scroll UI package. [SPA integration](https://github.com/highcard-dev/monorepo/blob/34e5b65a90f5f7e35883f681506659e8a4277ff4/apps/frontends/spa-app/src/components/lua/DruidUiProvider.tsx) |
| JavaScript/TypeScript-to-WASM build and browser loading | Build uses `componentize-js`; browser worker runs JCO transpilation before component instantiation | Optional retention, not an automatic deletion. If behavior is still authored as JS Component Model WASM, keep compatible compilation/loading. A core-WASM Rust/C guest can use a different, smaller ABI but entails a rewrite and different developer tooling. [Build](https://github.com/highcard-dev/druid-ui/blob/0cbd087dc7e386b42b6107941b2282c895055fec/packages/build/src/index.ts#L56), [JCO worker](https://github.com/highcard-dev/druid-ui/blob/0cbd087dc7e386b42b6107941b2282c895055fec/packages/host/src/transpile.worker.ts), [JCO capabilities](https://bytecodealliance.github.io/jco/) |
| Custom asynchronous guest callback bridge | Promise wrappers exchange request IDs with `asyncComplete` callbacks | OpenUI awaiting a JS tool does not by itself remove guest async interop. Prefer host-owned IO plus synchronous domain transforms where possible; otherwise retain or replace the guest RPC deliberately. [Guest async bridge](https://github.com/highcard-dev/druid-ui/blob/0cbd087dc7e386b42b6107941b2282c895055fec/packages/component/src/async.ts), [platform wrappers](https://github.com/highcard-dev/druid-ui/blob/0cbd087dc7e386b42b6107941b2282c895055fec/packages/plattform/src/index.ts) |

### A minimal config-editor interaction

Proposed sequence:

1. Load an authored Lang document plus its schema/optional behavior module through Druid's existing artifact delivery.
2. A read-only `load_config` Query calls a scoped host tool; a format adapter derives display data without discarding comments or unknown settings.
3. OpenUI owns the user's ordinary form draft. Domain validation/serialization runs when needed; a single explicit policy reconciles file switching and remote refresh with unsaved drafts.
4. Save runs an awaited `save_config` Mutation. It validates and serializes the draft, then requests the existing authorized host file operation and verifies readback. A failed save must not be reported as saved.
5. Optional restart is a separate host-authorized effect after successful save, not an optimistic fire-and-forget custom action.

The desired simplification is to stop treating rendering as untrusted executable guest code. Trust a finite React component catalog; let untrusted authors supply Lang documents and, where necessary, sandboxed behavior. Do not allow arbitrary uploaded React/JavaScript components into the main application as a shortcut. Bespoke uploaded HTML/CSS/DOM behavior from existing guests is a migration constraint, not something the finite component catalog preserves automatically.

This research changed only this note. It did not continue the paused PR merge/deployment work or modify application code.
