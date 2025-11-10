/// <reference types="../../types/druid-ui-extended.d.ts" />
/// <reference types="../../../../src/component/jsx.d.ts" />
/** @jsx d */
import {
  createComponent,
  d,
  type Event,
  log,
  rawAsyncToPromise,
} from "druid-ui/component";
import { requestGet } from "druid:ui/extension";
//import { rerender } from "druid:ui/ui";

let done = false;
export const component = createComponent(() => {
  if (!done) {
    rawAsyncToPromise(requestGet)("https://api.github.com/").then((data) => {
      log("Fetched data from extension:" + data);
    });
    done = true;
  }
  return (
    <div class="hello">
      <h2>Hello!</h2>
      <button
        onClick={(e: Event) => {
          log("Button clicked!");
          e.preventDefault();
        }}
      >
        Click me
      </button>
    </div>
  );
});
