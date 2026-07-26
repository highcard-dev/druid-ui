import { Event } from "./types";

export const DRUID_REACT_TAG_PREFIX = "react:";
export const DRUID_REACT_PROPS_PROP = "__druidReactProps";
export const DRUID_REACT_EVENTS_PROP = "__druidReactEvents";

export interface DruidReactComponentInstance {
  id: string;
  name: string;
  container: HTMLElement;
  props: Record<string, unknown>;
  eventProps: Record<string, string>;
  children: string[];
  emit: (eventType: string, value?: unknown) => void;
}

export type DruidReactComponentLifecycle =
  | {
      type: "mount" | "update";
      component: DruidReactComponentInstance;
    }
  | {
      type: "unmount";
      component: Pick<DruidReactComponentInstance, "id" | "container">;
    };

export type DruidReactComponentRenderer = (
  lifecycle: DruidReactComponentLifecycle,
) => void;

export function isDruidReactTag(element: string) {
  return element.startsWith(DRUID_REACT_TAG_PREFIX);
}

export function getDruidReactComponentName(element: string) {
  return element.slice(DRUID_REACT_TAG_PREFIX.length);
}

export function eventFromReactValue(value: unknown) {
  if (value && typeof value === "object") {
    const maybeEvent = value as {
      currentTarget?: { value?: unknown; checked?: unknown };
      target?: { value?: unknown; checked?: unknown };
    };
    const target = maybeEvent.currentTarget ?? maybeEvent.target;
    if (target) {
      return new Event(String(target.value ?? ""), target.checked === true);
    }
  }

  if (typeof value === "boolean") {
    return new Event(String(value), value);
  }

  if (typeof value === "string" || typeof value === "number") {
    return new Event(String(value), false);
  }

  if (value === undefined || value === null) {
    return new Event();
  }

  return new Event(JSON.stringify(value), false);
}
