export class Event {
  private _value: string;
  private _checked: boolean;

  constructor(_value: string = "", _checked: boolean = false) {
    this._value = _value;
    this._checked = _checked;
  }

  preventDefault() {}
  stopPropagation() {}
  value() {
    return this._value;
  }
  checked() {
    return this._checked;
  }
}
