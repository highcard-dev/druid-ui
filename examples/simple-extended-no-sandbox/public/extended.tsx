/// <reference types="../types/druid-ui-extended.d.ts" />
/// <reference types="../../../src/component/jsx.d.ts" />
/** @jsx d */
import type { Event } from "druid-ui/component";
import { createComponent, d, rawAsyncToPromise } from "druid-ui/component";

import { requestGet } from "druid:ui/extension";
let content = "";
export const component = createComponent(() => {
  return (
    <div class="hello">
      <h2>Hello!</h2>
      <button
        onClick={(e: Event) => {
          e.preventDefault();
          rawAsyncToPromise(requestGet)(
            "https://data.fixer.io/api/latest"
          ).then((data) => {
            console.log("Fetched data from extension:" + data);
            content = data;
          });
        }}
      >
        Click me
      </button>
      <p>Fetched content: {content}</p>
    </div>
  );
});
