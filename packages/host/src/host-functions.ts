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

export function clearNodes() {
  console.debug(`[clearNodes] Clearing ${nodes.size} nodes`);
  nodes.clear();
}

export function setHook(id: string, callback: string) {
  console.debug(`[setHook] Setting "${callback}" hook on node ${id}`);
  const node = nodes.get(id);
  if (node) {
    node.hooks = node.hooks || [];
    node.hooks.push(callback);
  }
}

export function dfunc(element: string, props: Props, children: string[]) {
  const id = crypto.randomUUID();
  console.debug(`[dfunc] Creating node: element="${element}", id=${id}`);

  nodes.set(id, { element, props, children });
  return id;
}

export function logfunc(msg: string) {
  console.log("UI LOG:", msg);
}

export function createDomFromIdRec(
  id: string,
  emitEvent: (id: string, eventType: string, event: Event) => void,
  navigate?: (href: string) => void,
): VNode | String {
  const node = nodes.get(id);
  //it is a bit strange to do it like that, in theory we want to better distinguish between text nodes and element nodes
  if (!node) {
    console.debug(`[createDomFromIdRec] Text node: "${id}"`);
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
        console.debug(`[event] "${eventType}" on node ${id}`);
        emitEvent(
          id,
          eventType,
          new Event(e?.currentTarget?.value, e?.currentTarget?.checked),
        );
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
  }

  // Set hooks (outside props check so hooks work even without props)
  if (node.hooks && node.hooks.length > 0) {
    console.debug(
      `[createDomFromIdRec] Node ${id} has ${
        node.hooks.length
      } hooks: ${node.hooks.join(", ")}`,
    );
    data.hook = {};
    for (const hookName of node.hooks) {
      data.hook[hookName as keyof typeof data.hook] = () => {
        console.debug(`[hook] "${hookName}" fired for node ${id}`);
        emitEvent(id, hookName, new Event());
      };
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
