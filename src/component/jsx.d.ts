declare namespace JSX {
  interface IntrinsicElements {
    [key: string]: any;
  }

  interface Element {
    // the type that your customJsx returns
    type: any;
    props: any;
  }

  interface ElementAttributesProperty {
    props: {};
  }

  interface ElementChildrenAttribute {
    children: {};
  }

  type ElementType = string | Function;
}
