declare module "druid:ui/initcomponent" {
  export function init(ctx: Context): string;
  export function emit(nodeid: string, event: string, e: Event): void;
  export interface Context {
    path: string;
  }

  export class Event {
    constructor(value: string, checked: boolean);
    preventDefault(): void;
    stopPropagation(): void;
    value(): string;
    checked(): boolean;
  }
}
