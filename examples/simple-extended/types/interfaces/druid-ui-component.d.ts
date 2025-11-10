/// <reference path="./druid-ui-utils.d.ts" />
declare module 'druid:ui/component' {
  export function init(ctx: Context): string;
  export function emit(nodeid: string, event: string, e: Event): void;
  export type Event = import('druid:ui/utils').Event;
  export type Context = import('druid:ui/utils').Context;
}
