/// <reference types="../../../../generated/types/guest/import/myworld.d.ts" />
/** @jsx d */
import { d, emit } from "./ui";
import { log } from "docs:adder/ui";

class Ev {
  constructor(private _value: string = "", private _checked: boolean = false) {
    log(`Event created with value: ${this._value}, checked: ${this._checked}`);
  }

  preventDefault() {
    log("preventDefault called");
  }
  stopPropagation() {
    log("stopPropagation called");
  }
  value() {
    return this._value;
  }
  checked() {
    return this._checked;
  }
}
let i = 0;

const ComponentV2 = {
  view: ({ title, description }) => (
    <div>
      <h1>{title}</h1>
      <h2>{description}</h2>
    </div>
  ),
};
const ComponentV3 = ({ title, description }) => (
  <div>
    <h1>{title}</h1>
    <h2>{description}</h2>
  </div>
);

export const initcomponent = {
  init: () => {
    return (
      <div class="hello">
        <h2>lol</h2>
        <main>
          wuuuu
          <div>fuckme</div>
          <input
            type="text"
            onChange={(e) => log(`Input changed: ${e.value()}`)}
          />
          <button
            onClick={(e) => {
              i++;
              log("Button clicked!");
              log(`Event value: ${e.value()}`);
              log(`Event checked: ${e.checked()}`);
              log(`Button clicked ${i} times`);
            }}
          >
            test
          </button>
          uut!!{i}
          <ComponentV2 title="This is it!" description="newschool" />
          <ComponentV3 title="This is it!" description="newschool" />
        </main>
        Hello!
      </div>
    );
  },
  emit: (nodeid: string, event: string, e: Event) => {
    log(`Emitting event ${event} for node ${nodeid}`);
    return emit(nodeid, event, e);
  },
  Event: Ev,
};
