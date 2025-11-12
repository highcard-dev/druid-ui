import hyperid from "hyperid";
import type { Props } from "druid:ui/ui";
import { h, type VNode, type VNodeChildren, type VNodeData } from "snabbdom";
import { Event } from "./types";

const nodes = new Map<
  string,
  {
    element: string;
    props?: any;
    children?: Array<string>;
  }
>();

export function dfunc(element: string, props: Props, children: string[]) {
  console.log("Creating DOM node:", element, props, children);
  const id = hyperid();

  nodes.set(id.uuid, { element, props, children });
  return id.uuid;
}

export function logfunc(msg: string) {
  console.log("UI LOG:", msg);
}

export function createDomFromIdRec(
  id: string,
  emitEvent: (fnid: string, eventType: string, event: Event) => void,
  navigate?: (href: string) => void
): VNode | String {
  const node = nodes.get(id);
  //it is a bit strange to do it like that, in theory we want to better distinguish between text nodes and element nodes
  if (!node) {
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
    for (const eventHandler of node.props.on) {
      const [eventType, fnid] = eventHandler;
      if (eventHandler) {
        data.on[eventType] = (e) => {
          console.log("Emitting event:", fnid, eventType, e);
          emitEvent(
            fnid,
            eventType,
            new Event(e?.currentTarget?.value, e?.currentTarget?.checked)
          );
        };
      }
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
  }

  const ch: VNodeChildren = [];
  if (node.children) {
    for (const childId of node.children) {
      const childEl = createDomFromIdRec(childId, emitEvent, navigate);
      ch.push(childEl);
    }
  }

  return h(node.element, data, ch);
}
