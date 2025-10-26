/** @module Interface docs:adder/initcomponent **/
export function init(): string;
export function emit(nodeid: string, event: string, e: Event): void;

export class Event {
  constructor(value: string, checked: boolean)
  preventDefault(): void;
  stopPropagation(): void;
  value(): string;
  checked(): boolean;
}
