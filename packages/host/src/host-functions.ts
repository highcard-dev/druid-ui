import type { Props } from "druid:ui/ui";
import { h, type VNode, type VNodeChildren, type VNodeData } from "snabbdom";
import { Event } from "./types";
import {
  DRUID_ISLAND_EVENTS_PROP,
  DRUID_ISLAND_PROPS_PROP,
  eventFromIslandValue,
  getDruidIslandName,
  isDruidIslandTag,
  type DruidIslandLifecycle,
} from "./islands";

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

export interface CreateDomOptions {
  islandLifecycle?: (lifecycle: DruidIslandLifecycle) => void;
}

function parseRecordProp(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value.length === 0) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    console.warn("Failed to parse Druid island props:", value);
  }

  return {};
}

function toPascalCase(value: string) {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function createIslandVNode(
  id: string,
  node: {
    element: string;
    props?: Props;
    children?: Array<string>;
  },
  emitEvent: (id: string, eventType: string, event: Event) => void,
  options?: CreateDomOptions,
) {
  const name = getDruidIslandName(node.element);
  const props: Record<string, unknown> = {};
  const events: Record<string, string> = {};

  if (node.props) {
    for (const prop of node.props.prop) {
      if (prop.key === DRUID_ISLAND_PROPS_PROP) {
        Object.assign(props, parseRecordProp(prop.value));
        continue;
      }
      if (prop.key === DRUID_ISLAND_EVENTS_PROP) {
        Object.assign(events, parseRecordProp(prop.value));
        continue;
      }
      props[prop.key] = prop.value;
    }

    for (const eventType of node.props.on) {
      const propName = `on${toPascalCase(eventType)}`;
      events[propName] = eventType;
    }
  }

  const children = (node.children ?? []).filter((childId) => !nodes.has(childId));
  const data: VNodeData = {
    attrs: {
      "data-druid-island": name,
    },
    hook: {
      insert: (vnode) => {
        const container = vnode.elm;
        if (!(container instanceof HTMLElement)) {
          return;
        }
        options?.islandLifecycle?.({
          type: "mount",
          island: {
            id,
            name,
            container,
            props,
            events,
            children,
            emit: (eventType, value) =>
              emitEvent(id, eventType, eventFromIslandValue(value)),
          },
        });
      },
      postpatch: (_oldVnode, vnode) => {
        const container = vnode.elm;
        if (!(container instanceof HTMLElement)) {
          return;
        }
        options?.islandLifecycle?.({
          type: "update",
          island: {
            id,
            name,
            container,
            props,
            events,
            children,
            emit: (eventType, value) =>
              emitEvent(id, eventType, eventFromIslandValue(value)),
          },
        });
      },
      destroy: (vnode) => {
        const container = vnode.elm;
        if (!(container instanceof HTMLElement)) {
          return;
        }
        options?.islandLifecycle?.({
          type: "unmount",
          island: { id, container },
        });
      },
    },
  };

  return h("druid-island", data);
}

export function createDomFromIdRec(
  id: string,
  emitEvent: (id: string, eventType: string, event: Event) => void,
  options?: CreateDomOptions,
): VNode | String {
  const node = nodes.get(id);
  //it is a bit strange to do it like that, in theory we want to better distinguish between text nodes and element nodes
  if (!node) {
    console.debug(`[createDomFromIdRec] Text node: "${id}"`);
    return id;
  }

  if (isDruidIslandTag(node.element)) {
    return createIslandVNode(id, node, emitEvent, options);
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
      const childEl = createDomFromIdRec(childId, emitEvent, options);
      ch.push(childEl);
    }
  }

  return h(node.element, data, ch);
}
