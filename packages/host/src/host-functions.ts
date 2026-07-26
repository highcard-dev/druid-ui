import type { Props } from "druid:ui/ui";
import { h, type VNode, type VNodeChildren, type VNodeData } from "snabbdom";
import { Event } from "./types";
import {
  DRUID_REACT_EVENTS_PROP,
  DRUID_REACT_PROPS_PROP,
  eventFromReactValue,
  getDruidReactComponentName,
  isDruidReactTag,
  type DruidReactComponentLifecycle,
} from "./react-components";

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
  reactComponentLifecycle?: (lifecycle: DruidReactComponentLifecycle) => void;
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
    console.warn("Failed to parse Druid React component props:", value);
  }

  return {};
}

function toPascalCase(value: string) {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function createReactComponentVNode(
  id: string,
  node: {
    element: string;
    props?: Props;
    children?: Array<string>;
  },
  emitEvent: (id: string, eventType: string, event: Event) => void,
  options?: CreateDomOptions,
) {
  const name = getDruidReactComponentName(node.element);
  const props: Record<string, unknown> = {};
  const eventProps: Record<string, string> = {};

  if (node.props) {
    for (const prop of node.props.prop) {
      if (prop.key === DRUID_REACT_PROPS_PROP) {
        Object.assign(props, parseRecordProp(prop.value));
        continue;
      }
      if (prop.key === DRUID_REACT_EVENTS_PROP) {
        Object.assign(eventProps, parseRecordProp(prop.value));
        continue;
      }
      props[prop.key] = prop.value;
    }

    for (const eventType of node.props.on) {
      const propName = `on${toPascalCase(eventType)}`;
      eventProps[propName] = eventType;
    }
  }

  const children = (node.children ?? []).filter((childId) => !nodes.has(childId));
  const data: VNodeData = {
    attrs: {
      "data-druid-react-component": name,
    },
    hook: {
      insert: (vnode) => {
        const container = vnode.elm;
        if (!(container instanceof HTMLElement)) {
          return;
        }
        options?.reactComponentLifecycle?.({
          type: "mount",
          component: {
            id,
            name,
            container,
            props,
            eventProps,
            children,
            emit: (eventType, value) =>
              emitEvent(id, eventType, eventFromReactValue(value)),
          },
        });
      },
      postpatch: (_oldVnode, vnode) => {
        const container = vnode.elm;
        if (!(container instanceof HTMLElement)) {
          return;
        }
        options?.reactComponentLifecycle?.({
          type: "update",
          component: {
            id,
            name,
            container,
            props,
            eventProps,
            children,
            emit: (eventType, value) =>
              emitEvent(id, eventType, eventFromReactValue(value)),
          },
        });
      },
      destroy: (vnode) => {
        const container = vnode.elm;
        if (!(container instanceof HTMLElement)) {
          return;
        }
        options?.reactComponentLifecycle?.({
          type: "unmount",
          component: { id, container },
        });
      },
    },
  };

  return h("druid-react-component", data);
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

  if (isDruidReactTag(node.element)) {
    return createReactComponentVNode(id, node, emitEvent, options);
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
