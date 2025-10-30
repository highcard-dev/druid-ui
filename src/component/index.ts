import { Event } from "druid:ui/utils";
import { d as dfunc, type Prop, type Props } from "druid:ui/ui";

const eventMap: Record<string, Record<string, Function>> = {};

function fnv1aHash(str: string) {
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
}

export function emit(nodeid: string, event: string, e: Event) {
  const callbacks = eventMap[nodeid];
  callbacks?.[event]?.(e);
}
