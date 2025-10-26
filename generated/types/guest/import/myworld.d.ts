/// <reference path="./interfaces/docs-adder-initcomponent.d.ts" />
/// <reference path="./interfaces/docs-adder-ui.d.ts" />
declare module 'docs:adder/myworld' {
  export type * as DocsAdderUi from 'docs:adder/ui'; // import docs:adder/ui
  export * as initcomponent from 'docs:adder/initcomponent'; // export docs:adder/initcomponent
}
