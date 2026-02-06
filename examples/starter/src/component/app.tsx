/// <reference types="@druid-ui/component/types" />
/// <reference types="@druid-ui/component/jsx" />
/** @jsx d */
import { Context, d, Event, log, createComponent } from "@druid-ui/component";

let clickCount = 0;

export const component = createComponent((ctx: Context) => {
  log(`Component initialized at path: ${ctx.path}`);

  return (
    <div>
      <h1>Welcome to Druid UI</h1>
      <p>
        Edit <code>src/component/app.tsx</code> to see HMR in action!
      </p>
      <main>
        <button
          onClick={(e: Event) => {
            clickCount++;
            log(`Clicked ${clickCount} times`);
          }}
        >
          Click me
        </button>
        <p>
          <b>Clicks:</b> {clickCount}
        </p>
      </main>
    </div>
  );
});
