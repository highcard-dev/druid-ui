import type { VNode } from "snabbdom";

interface Event {
  value: string;
  checked: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

export type Component = {
  view: (props?: any) => VNode;
  oninit?: () => void;
};

export interface Routes {
  index: Component;
  notfound: Component;
  [key: string]: Component;
}
