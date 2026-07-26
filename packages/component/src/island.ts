import { d as dfunc } from "druid:ui/ui";
import { createDFunc } from "./utils";

const islandTagPrefix = "island:";
const islandPropsProp = "__druidIslandProps";
const islandEventsProp = "__druidIslandEvents";

type DruidIslandProps = Record<string, unknown>;

const d = createDFunc(dfunc);

function eventKeyForProp(propName: string) {
  return propName.startsWith("on")
    ? propName.slice(2).toLowerCase()
    : propName.toLowerCase();
}

function toSerializableProps(props: DruidIslandProps) {
  const serializableProps: DruidIslandProps = {};
  const eventProps: Record<string, string> = {};
  const callbackProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "function") {
      eventProps[key] = eventKeyForProp(key);
      callbackProps[key] = value;
      continue;
    }

    serializableProps[key] = value;
  }

  return { serializableProps, eventProps, callbackProps };
}

export function island(
  name: string,
  props: DruidIslandProps = {},
  ...children: unknown[]
) {
  const { serializableProps, eventProps, callbackProps } =
    toSerializableProps(props);

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
