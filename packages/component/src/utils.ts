import type { Prop, Props } from "druid:ui/ui";
import { log, rerender, d, setHook } from "druid:ui/ui";
import type { Event } from "@druid-ui/host";
import type { Context } from "druid:ui/component";

export const callbackMap: Record<string, Record<string, Function>> = {};

export function emit(nodeid: string, event: string, e: Event) {
  log(`Emit called for nodeid: ${nodeid}, event: ${event}`);
  const callbacks = callbackMap[nodeid];
  const result = callbacks?.[event]?.(e);
  // if we have have shim3 with async support, we can call rerender external only
  if (result instanceof Promise) {
    result.then(() => rerender());
  }
}

const registerHooks = (
  id: string,
  fnresult: {
    view: (props?: any) => string;
    init?: () => void;
  },
) => {
  switch (true) {
    case !!fnresult.init:
      setHook(id, "init");
      callbackMap[id] = {
        ...callbackMap[id],
        init: fnresult.init,
      };
      break;
  }
};

export const createDFunc = (dfunc: typeof d) => {
  return (
    tag:
      | string
      | { view: (props?: any) => string; init?: () => void }
      | ((props?: any) => void)
      | ((props?: any) => { view: (props?: any) => string; init?: () => void }),
    props?: Record<string, any>,
    ...children: string[] | Array<string[]>
  ) => {
    //flatten children, e.g. .map(...) returns array of arrays
    children = children.flat();
    if (typeof tag !== "string") {
      if (typeof tag === "function") {
        const fnresult = tag(props);
        if (fnresult?.view) {
          const id = fnresult.view(props);
          registerHooks(id, fnresult);
          return id;
        } else {
          return tag(props);
        }
      }
      const id = tag.view(props);
      registerHooks(id, tag);
      return id;
    }

    const ps: Props = { prop: [] as Prop[], on: [] };
    const cbObj: Record<string, Function> = {};
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value instanceof Function) {
          const eventKey = key.startsWith("on")
            ? key.slice(2).toLowerCase()
            : key;

          cbObj[eventKey] = value;

          ps.on.push(eventKey);
        } else {
          if (typeof value === "boolean") {
            //e.g. disabled, checked does not have a "false"
            if (value) {
              ps.prop.push({ key, value: "true" });
            }
            continue;
          }
          ps.prop.push({ key, value });
        }
      }
    }
    const id = dfunc(
      tag,
      ps,
      children.filter((c) => typeof c !== "boolean").map((c) => c?.toString()),
    );
    callbackMap[id] = {
      ...callbackMap[id],
      ...cbObj,
    };
    return id;
  };
};

// Module-level map that tracks pending async operations initiated through wrappers
const pendingOperations = new Map<
  string,
  { resolve: (value: any) => void; reject: (error: any) => void }
>();

export const asyncCallback = (
  id: string,
  result: { tag: "ok" | "err"; val: any },
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
