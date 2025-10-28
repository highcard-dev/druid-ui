/// <reference path="./interfaces/druid-ui-component.d.ts" />
/// <reference path="./interfaces/druid-ui-ui.d.ts" />
/// <reference path="./interfaces/druid-ui-utils.d.ts" />
declare module 'druid:ui/druid-ui' {
  export type * as DruidUiUi from 'druid:ui/ui'; // import druid:ui/ui
  export type * as DruidUiUtils from 'druid:ui/utils'; // import druid:ui/utils
  export * as component from 'druid:ui/component'; // export druid:ui/component
}
