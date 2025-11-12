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

let done = false;
let disabled = false;
let content = "";

let url = "https://api.github.com/";
export const component = createComponent(() => {
  if (!done) {
    done = true;
  }
  return (
    <div class="hello">
      <h2>Hello!</h2>
      <input
        type="text"
        value={url}
        onKeyUp={(e: Event) => {
          url = e.value();
        }}
      />
      <button
        disabled={disabled ? "true" : ""}
        onClick={(e: Event) => {
          disabled = true;
          rawAsyncToPromise(requestGet)("https://api.github.com/")
            .then((data) => {
              log(("Fetched data:" + data) as string);
              content = data as string;
            })
            .finally(() => {
              log("Fetch operation completed");
              disabled = false;
            });
          e.preventDefault();
        }}
      >
        Click me
      </button>
      {!!content && (
        <div>
          <hr />
          <h2>Content</h2>
          <pre>{content}</pre>
        </div>
      )}
    </div>
  );
});
