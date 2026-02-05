type DruidComponent<T = any> = () => {
  init?: () => void;
  view: (props: T) => JSX.Element;
};
type DruidFC<T = any> = (props: T) => JSX.Element;

declare namespace JSX {
  interface Element {}

  interface ElementAttributesProperty {
    view: any; // TS will infer props from `view`
  }

  interface IntrinsicElements {
    [key: string]: any;
  }

  interface ElementChildrenAttribute {
    children: {};
  }

  type ElementType = string | DruidFC | DruidComponent;
}
