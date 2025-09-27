import { h, type On, type VNodeChildElement } from "snabbdom";

export const dfunc = (
  selector: string | { view: (props: Record<string, any>) => string },
  propsOrContent?: object | VNodeChildElement,
  content?: VNodeChildElement
) => {
  let props: Record<string, any> = {};
  const vProps: Record<string, any> = {};
  const vOn: On = {};

  if (typeof propsOrContent === "string" || Array.isArray(propsOrContent)) {
    content = propsOrContent as VNodeChildElement;
  } else if (typeof propsOrContent === "object") {
    props = propsOrContent as Record<string, any>;
  }

  if (typeof selector === "object") {
    return selector.view(props);
  }

  if (selector.startsWith(".") || selector.startsWith("#")) {
    selector = "div" + selector;
  }

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "function") {
      const idx = key.indexOf("on");
      vOn[key.slice(idx + 2).toLowerCase()] = (e) =>
        (value as Function)({
          value: e.target.value,
          checked: e.target.checked,
          preventDefault: e.preventDefault.bind(e),
          stopPropagation: e.stopPropagation.bind(e),
        });
    } else {
      vProps[key] = value;
    }
  }

  return h(
    selector,
    {
      props: vProps,
      on: vOn,
    },
    content
  );
};
