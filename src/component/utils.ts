import type { Prop, Props } from "druid:ui/ui";
import { log, rerender } from "druid:ui/ui";
import type { Event } from "../types";
import type { Context } from "druid:ui/component";

export function fnv1aHash(str: string) {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

export const eventMap: Record<string, Record<string, Function>> = {};

export function emit(nodeid: string, event: string, e: Event) {
  log(`Emit called for nodeid: ${nodeid}, event: ${event}`);
  const callbacks = eventMap[nodeid];
  callbacks?.[event]?.(e);
}

export const createDFunc = (
  dfunc: (element: string, props: Props, children: string[]) => string
) => {
  return (
    tag: string | { view: (props?: any) => void } | ((props?: any) => void),
    props?: Record<string, any>,
    ...children: string[]
  ) => {
    if (typeof tag !== "string") {
      if (typeof tag === "function") {
        return tag(props);
      }
      return tag.view(props);
    }

    const ps: Props = { prop: [] as Prop[], on: [] };
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value instanceof Function) {
          const eventKey = key.startsWith("on")
            ? key.slice(2).toLowerCase()
            : key;

          const cbId = fnv1aHash(value.toString());

          eventMap[cbId] = eventMap[cbId] || {};
          eventMap[cbId][eventKey] = value;

          ps.on.push([eventKey, cbId]);
        } else {
          ps.prop.push({ key, value });
        }
      }
    }
    return dfunc(
      tag,
      ps,
      children.map((c) => c.toString())
    );
  };
};

// Module-level map that tracks pending async operations initiated through wrappers
const pendingOperations = new Map<
  string,
  { resolve: (value: any) => void; reject: (error: any) => void }
>();

export const asyncCallback = (
  id: string,
  result: { tag: "ok" | "err"; val: any }
) => {
  log(`Async callback received for id: ${id} with result: ${result.tag}`);
  const pending = pendingOperations.get(id);
  if (pending) {
    if (result.tag === "ok") {
      pending.resolve(result.val);
    } else {
      pending.reject(new Error(result.val));
    }
    pendingOperations.delete(id);
    rerender();
  }
};

export const rawAsyncToPromise =
  <T>(fn: (...args: any[]) => any) =>
  (...args: any[]) => {
    return new Promise<T>((resolve, reject) => {
      const asyncId = fn(...args);
      pendingOperations.set(asyncId, { resolve, reject });
    });
  };

export const createComponent = (j: (ctx: Context) => string | JSX.Element) => ({
  init: (ctx: Context) => j(ctx),
  emit: emit,
  asyncComplete: asyncCallback,
});
