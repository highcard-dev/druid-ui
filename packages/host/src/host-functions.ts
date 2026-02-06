import hyperid from "hyperid";
import type { Props } from "druid:ui/ui";
import { h, type VNode, type VNodeChildren, type VNodeData } from "snabbdom";
import { Event } from "./types";

const nodes = new Map<
  string,
  {
    element: string;
    props?: Props;
    children?: Array<string>;
    hooks?: string[];
  }
>();

export function setHook(id: string, callback: string) {
  console.debug(`Setting hook for id ${id} with callback ${callback}`);
  const node = nodes.get(id);
  if (node) {
    node.hooks = node.hooks || [];
    node.hooks.push(callback);
  } else {
    console.warn(`setHook: No node found for id ${id}`);
  }
}

export function dfunc(element: string, props: Props, children: string[]) {
  console.debug("Creating DOM node:", element, props, children);
  const id = hyperid();

  nodes.set(id.uuid, { element, props, children });
  return id.uuid;
}

export function logfunc(msg: string) {
  console.debug("UI LOG:", msg);
}

export function createDomFromIdRec(
  id: string,
  rerender: () => void,
  emitEvent: (id: string, eventType: string, event: Event) => void,
  navigate?: (href: string) => void
): VNode | String {
  const node = nodes.get(id);
  //it is a bit strange to do it like that, in theory we want to better distinguish between text nodes and element nodes
  if (!node) {
    console.debug("Creating text node for id:", id);
    return id;
  }

  const data: VNodeData = {};

  // Set properties
  if (node.props) {
    data.props = {};
    for (const prop of node.props.prop) {
      data.props[prop.key] = prop.value;
    }
    data.on = {};
    for (const eventType of node.props.on) {
      data.on[eventType] = (e) => {
        console.debug("Emitting event:", id, eventType, e);
        emitEvent(
          id,
          eventType,
          new Event(e?.currentTarget?.value, e?.currentTarget?.checked)
        );
        rerender();
      };
    }
    const href = data.props["href"];
    if (href && !data.on["click"]) {
      if (navigate) {
        data.on.click = (e) => {
          e.preventDefault();
          navigate(href);
        };
      }
    }

    if (node.hooks) {
      data.hook = {};
      for (const hookName of node.hooks) {
        data.hook[hookName as keyof typeof data.hook] = () => {
          emitEvent(id, hookName, new Event());
        };
      }
    }
  }

  const ch: VNodeChildren = [];
  if (node.children) {
    for (const childId of node.children) {
      const childEl = createDomFromIdRec(
        childId,
        rerender,
        emitEvent,
        navigate
      );
      ch.push(childEl);
    }
  }

  return h(node.element, data, ch);
}
