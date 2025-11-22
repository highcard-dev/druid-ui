/// <reference types="../../../../src/plattform/types/druid-plattform.d.ts" />
/// <reference types="../../../../src/component/jsx.d.ts" />
/** @jsx d */
import { Context, d, createComponent, log } from "druid-ui/component";
import { request } from "druid-ui/plattform";

export const component = createComponent((ctx: Context) => {
  log("Druid Plattform Component");
  return (
    <div>
      <button onClick={() => request("url", "GET", "", ["header", "value"])}>
        request
      </button>
      <br />
      todo: create a better example for using the druid plattform
    </div>
  );
});
