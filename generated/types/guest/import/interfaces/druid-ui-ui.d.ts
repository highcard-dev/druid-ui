declare module 'druid:ui/ui' {
  export function d(element: string, props: Props, children: Children): string;
  export function log(msg: string): void;
  export function fetch(url: string): AsyncId;
  export function rerender(): void;
  export interface Prop {
    key: string,
    value: string,
  }
  export interface Props {
    prop: Array<Prop>,
    on: Array<[string, string]>,
  }
  export type AsyncId = string;
  export type Children = Array<string> | undefined;
}
