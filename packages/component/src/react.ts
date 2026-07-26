import { d as dfunc } from "druid:ui/ui";
import { createDFunc } from "./utils";

const reactTagPrefix = "react:";
const reactPropsProp = "__druidReactProps";
const reactEventsProp = "__druidReactEvents";

type DruidReactComponentProps = Record<string, unknown>;

const d = createDFunc(dfunc);

function eventKeyForProp(propName: string) {
  return propName.startsWith("on")
    ? propName.slice(2).toLowerCase()
    : propName.toLowerCase();
}

function toSerializableProps(props: DruidReactComponentProps) {
  const serializableProps: DruidReactComponentProps = {};
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

export function react(
  name: string,
  props: DruidReactComponentProps = {},
  ...children: unknown[]
) {
  const { serializableProps, eventProps, callbackProps } =
    toSerializableProps(props);

  return d(
    `${reactTagPrefix}${name}`,
    {
      [reactPropsProp]: JSON.stringify(serializableProps),
      [reactEventsProp]: JSON.stringify(eventProps),
      ...callbackProps,
    },
    ...children.flat().map((child) => String(child)),
  );
}
