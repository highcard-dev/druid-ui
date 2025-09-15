import type { FENode, Props } from "./types.js";

export const dfunc = (
  selector: string | { view: (props: Props) => string },
  propsOrContent?: FENode | Props | FENode[],
  content?: FENode | FENode[] | string | string[]
) => {
  let props: Props = {};
  if (
    typeof propsOrContent === "string" ||
    Array.isArray(propsOrContent) ||
    (propsOrContent && "selector" in propsOrContent)
  ) {
    content = propsOrContent as string | string[] | FENode | FENode[];
  } else if (typeof propsOrContent === "object") {
    props = propsOrContent as Props;
  }

  if (typeof selector === "object") {
    return selector.view(props);
  }

  const node: FENode = {
    selector: selector,
    props,
    children: Array.isArray(content) ? content : content ? [content] : [],
  };
  return node;
};
