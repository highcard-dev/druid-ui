/** @module Interface druid:ui/ui **/
export function d(element: string, props: Props, children: Children): string;
export function log(msg: string): void;
export interface Prop {
  key: string;
  value: string;
}
export interface Props {
  prop: Array<Prop>;
  on: Array<[string, string]>;
}
export type Children = Array<string> | undefined;
