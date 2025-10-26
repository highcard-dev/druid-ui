declare module 'docs:adder/initcomponent' {
  export function init(): string;
  export function emit(nodeid: string, event: string, e: Event): void;
  
  export class Event {
    constructor()
    preventDefault(): void;
    stopPropagation(): void;
    value(): string;
    checked(): boolean;
  }
}
