import { d } from "./index";

// Adapter for React JSX runtime - extracts children from props
export function jsx(type: any, props: any) {
  const { children, ...rest } = props || {};
  if (children !== undefined) {
    return d(type, rest, children);
  }
  return d(type, rest);
}

// jsxs is the same as jsx (used for multiple children)
export const jsxs = jsx;

// jsxDEV is the same for development
export const jsxDEV = jsx;

// Fragment is just an empty element for druid-ui
export const Fragment = Symbol.for("react.fragment");
