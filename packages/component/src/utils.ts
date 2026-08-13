import type { Prop, Props } from "druid:ui/ui";
import { log, rerender, d, setHook } from "druid:ui/ui";
import type { Event } from "@druid-ui/host";
import type { Context } from "druid:ui/component";
import { createAsyncBridge } from "./async";
import { lowerPropertyValue } from "./props";

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
          const loweredValue = lowerPropertyValue(value);
          if (loweredValue === undefined) continue;
          // Boolean DOM properties must be present on every render. Omitting
          // `false` leaves a previously true property (for example disabled or
          // checked) stuck when snabbdom patches the existing element.
          if (typeof value === "boolean") {
            ps.prop.push({ key, value: loweredValue });
            continue;
          }
          // The component WIT contract transports property values as strings.
          // Raw JavaScript tolerated numbers here, but componentized WASM traps
          // while lowering a non-string value across the canonical ABI.
          ps.prop.push({ key, value: loweredValue });
        }
      }
    }
    const id = dfunc(
      tag,
      ps,
      children.filter((c) => typeof c !== "boolean").map((c) => String(c)),
    );
    callbackMap[id] = {
      ...callbackMap[id],
      ...cbObj,
    };
    return id;
  };
};

const asyncBridge = createAsyncBridge(
  () => rerender(),
  (message) => log(message),
);

export const asyncCallback = asyncBridge.complete;
export const rawAsyncToPromise = asyncBridge.wrap;

export const createComponent = (j: (ctx: Context) => string | JSX.Element) => ({
  init: (ctx: Context) => j(ctx),
  emit: emit,
  asyncComplete: asyncCallback,
});
