import { Event } from "./types";

export const DRUID_ISLAND_TAG_PREFIX = "island:";
export const DRUID_ISLAND_PROPS_PROP = "__druidIslandProps";
export const DRUID_ISLAND_EVENTS_PROP = "__druidIslandEvents";

export interface DruidIsland {
  id: string;
  name: string;
  container: HTMLElement;
  props: Record<string, unknown>;
  events: Record<string, string>;
  children: string[];
  emit: (eventType: string, value?: unknown) => void;
}

export type DruidIslandLifecycle =
  | {
      type: "mount" | "update";
      island: DruidIsland;
    }
  | {
      type: "unmount";
      island: Pick<DruidIsland, "id" | "container">;
    };

export type DruidIslandRenderer = (
  lifecycle: DruidIslandLifecycle,
) => void;

export function isDruidIslandTag(element: string) {
  return element.startsWith(DRUID_ISLAND_TAG_PREFIX);
}

export function getDruidIslandName(element: string) {
  return element.slice(DRUID_ISLAND_TAG_PREFIX.length);
}

export function eventFromIslandValue(value: unknown) {
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
