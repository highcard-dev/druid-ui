import type { VNode } from "snabbdom";

export type Component = {
  view: (props?: any) => VNode;
  oninit?: () => void;
};

export interface Routes {
  index: Component;
  notfound: Component;
  [key: string]: Component;
}
