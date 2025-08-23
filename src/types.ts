export type eventCallback = (e: string) => void;

export type Props = Record<string, string | eventCallback | undefined>;

export type FENode = {
  selector: string;
  props: Props;
  children: (FENode | string)[];
};

export type Component = {
  view: () => Element;
  oninit?: () => void;
};

export interface Routes {
  index: Component;
  notfound: Component;
  [key: string]: Component;
}
