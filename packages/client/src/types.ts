/// <reference path="../generated/openui-client.d.ts" preserve="true" />
export type ClientExports = typeof import("druid:openui/client");
export type HostImports = typeof import("druid:openui/host");
export type StateImports = typeof import("druid:openui/state");
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
