import { d as dfunc } from "druid:ui/ui";
import { createDFunc } from "./utils";

const islandTagPrefix = "island:";
const islandPropsProp = "__druidIslandProps";
const islandEventsProp = "__druidIslandEvents";

type DruidIslandProps = Record<string, unknown>;

const d = createDFunc(dfunc);

export function island(
  name: string,
  props: DruidIslandProps = {},
  ...children: unknown[]
) {
  const serializableProps: DruidIslandProps = {};
  const eventProps: Record<string, string> = {};
  const callbackProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "function") {
      eventProps[key] = (key.startsWith("on") ? key.slice(2) : key).toLowerCase();
      callbackProps[key] = value;
    } else {
      serializableProps[key] = value;
    }
  }

  return d(
    `${islandTagPrefix}${name}`,
    {
      [islandPropsProp]: JSON.stringify(serializableProps),
      [islandEventsProp]: JSON.stringify(eventProps),
      ...callbackProps,
    },
    ...children.flat().map((child) => String(child)),
  );
}
