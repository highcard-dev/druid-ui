declare module 'druid:ui/utils' {
  export interface Context {
    path: string,
  }
  
  export class Event implements Disposable {
    constructor(value: string, checked: boolean)
    preventDefault(): void;
    stopPropagation(): void;
    value(): string;
    checked(): boolean;
    [Symbol.dispose](): void;
  }
}
