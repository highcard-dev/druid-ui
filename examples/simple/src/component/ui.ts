import { Event } from "docs:adder/initcomponent";
import { d as dfunc, Prop, Props } from "docs:adder/ui";
import { log } from "docs:adder/ui";

const eventMap: Record<string, Record<string, Function>> = {};

function fnv1aHash(str) {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36);
}

export function d(
  tag: string | { view: (props?: any) => void } | ((props?: any) => void),
  props?: Record<string, any>,
  ...children: string[]
) {
  log(tag.toString());
  if (typeof tag !== "string") {
    log("Rendering component via its view method");
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
}

export function emit(nodeid: string, event: string, e: Event) {
  log(`1: Emitting event ${event} for node ${nodeid}`);
  const callbacks = eventMap[nodeid];
  log(`2: Emitting event ${event} for node ${nodeid}`);
  callbacks?.[event]?.(e);
}
