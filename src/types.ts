interface Event {
  value: string;
  checked: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
}

export type eventCallback = (e: Event) => void;

export type Props = Record<string, string | eventCallback | undefined>;

export type FENode = {
  selector: string;
  props: Props;
  children: (FENode | string)[];
};

export type Component = {
  view: (props?: any) => Element;
  oninit?: () => void;
};

export interface Routes {
  index: Component;
  notfound: Component;
  [key: string]: Component;
}
