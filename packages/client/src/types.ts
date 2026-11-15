/// <reference path="../generated/openui-client.d.ts" preserve="true" />
/// <reference path="../generated/browser-client.d.ts" preserve="true" />
export type BrowserImports = {
  "druid:openui/http": typeof import("druid:openui/http");
  "druid:openui/animation": typeof import("druid:openui/animation");
  "druid:openui/canvas": typeof import("druid:openui/canvas");
  "druid:openui/webgl": typeof import("druid:openui/webgl");
  "druid:openui/webgpu": typeof import("druid:openui/webgpu");
  "druid:openui/audio": typeof import("druid:openui/audio");
  "druid:openui/video": typeof import("druid:openui/video");
};
export type ClientExports = typeof import("druid:openui/client");
export type KeyboardExports = typeof import("druid:openui/keyboard");
export type KeyEvent = import("druid:openui/keyboard").KeyEvent;
export type PointerExports = typeof import("druid:openui/pointer");
export type PointerEvent = import("druid:openui/pointer").PointerEvent;
export type HostImports = typeof import("druid:openui/host");
export type StateImports = typeof import("druid:openui/state");
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
