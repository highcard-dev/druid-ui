import { Event } from "./types";

export const DRUID_ISLAND_TAG_PREFIX = "island:";
export const DRUID_ISLAND_PROPS_PROP = "__druidIslandProps";
export const DRUID_ISLAND_EVENTS_PROP = "__druidIslandEvents";

export type DruidIslandChild = string | DruidIslandNode;

export interface DruidIslandNode {
  id: string;
  name: string;
  props: Record<string, unknown>;
  events: Record<string, string>;
  children: DruidIslandChild[];
  emit: (eventType: string, value?: unknown) => void;
}

export interface DruidIsland extends DruidIslandNode {
  container: HTMLElement;
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
  const target =
    value && typeof value === "object"
      ? (value as {
          currentTarget?: { value?: unknown; checked?: unknown };
          target?: { value?: unknown; checked?: unknown };
        }).currentTarget ??
        (value as { target?: { value?: unknown; checked?: unknown } }).target
      : undefined;

  return target
    ? new Event(String(target.value ?? ""), target.checked === true)
    : new Event(
        value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value),
        value === true,
      );
}
