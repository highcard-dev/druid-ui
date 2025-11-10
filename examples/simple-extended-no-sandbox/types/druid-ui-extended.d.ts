/// <reference path="./interfaces/druid-ui-component.d.ts" />
/// <reference path="./interfaces/druid-ui-extension.d.ts" />
/// <reference path="./interfaces/druid-ui-ui.d.ts" />
/// <reference path="./interfaces/druid-ui-utils.d.ts" />
declare module 'druid:ui/druid-ui-extended' {
  import type * as DruidUiExtension from 'druid:ui/extension'; // druid:ui/extension
  import type * as DruidUiUi from 'druid:ui/ui'; // druid:ui/ui
  import type * as DruidUiUtils from 'druid:ui/utils'; // druid:ui/utils
  import type * as DruidUiComponent from 'druid:ui/component'; // druid:ui/component
  export interface ImportObject {
    'druid:ui/extension': typeof DruidUiExtension,
    'druid:ui/ui': typeof DruidUiUi,
    'druid:ui/utils': typeof DruidUiUtils,
  }
  export interface DruidUiExtended {
    'druid:ui/component': typeof DruidUiComponent,
    component: typeof DruidUiComponent,
  }
  
  /**
  * Instantiates this component with the provided imports and
  * returns a map of all the exports of the component.
  *
  * This function is intended to be similar to the
  * `WebAssembly.instantiate` function. The second `imports`
  * argument is the "import object" for wasm, except here it
  * uses component-model-layer types instead of core wasm
  * integers/numbers/etc.
  *
  * The first argument to this function, `getCoreModule`, is
  * used to compile core wasm modules within the component.
  * Components are composed of core wasm modules and this callback
  * will be invoked per core wasm module. The caller of this
  * function is responsible for reading the core wasm module
  * identified by `path` and returning its compiled
  * `WebAssembly.Module` object. This would use `compileStreaming`
  * on the web, for example.
  */
  export function instantiate(
  getCoreModule: (path: string) => WebAssembly.Module,
  imports: ImportObject,
  instantiateCore?: (module: WebAssembly.Module, imports: Record<string, any>) => WebAssembly.Instance
  ): DruidUiExtended;
  export function instantiate(
  getCoreModule: (path: string) => WebAssembly.Module | Promise<WebAssembly.Module>,
  imports: ImportObject,
  instantiateCore?: (module: WebAssembly.Module, imports: Record<string, any>) => WebAssembly.Instance | Promise<WebAssembly.Instance>
  ): DruidUiExtended | Promise<DruidUiExtended>;
  
}
