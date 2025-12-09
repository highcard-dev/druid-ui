declare module 'druid:ui/ui' {
  export function d(element: string, props: Props, children: Children, hooks: Hooks): string;
  export function log(msg: string): void;
  export function setHook(id: AsyncId, hook: string): void;
  export function rerender(): void;
  export interface Prop {
    key: string,
    value: string,
  }
  export interface Props {
    prop: Array<Prop>,
    on: Array<string>,
  }
  export type AsyncId = string;
  export type Children = Array<string> | undefined;
  export interface Hooks {
    oninit?: string,
    oncreate?: string,
    onupdate?: string,
    onbeforeremove?: string,
    onremove?: string,
    onbeforeupdate?: string,
  }
}
