/// <reference types="../../../../generated/types/guest/import/druid-ui.d.ts" />
/// <reference types="../../../../src/component/jsx.d.ts" />
/** @jsx d */
import { Context, d, Event, log, createComponent } from "druid-ui/component";

let i = 0;

interface ComponentTitle {
  title: string;
  description: string;
}

const ComponentTitle = ({ title, description }: ComponentTitle) => (
  <div>
    <h1>{title}</h1>
    <h2>{description}</h2>
  </div>
);

function ComponentTitle2({ title, description }: ComponentTitle) {
  return {
    view: () => (
      <div>
        <h1>{title}</h1>
        <h2>{description}</h2>
      </div>
    ),
  };
}

export const component = createComponent((ctx: Context) => {
  //setTimeout(() => log("lol"), 5000);
  log(`Init called with path: ${ctx.path}`);
  if (ctx.path == "/test") {
    return (
      <div>
        <a href="/">go back</a>
        Test path reached
      </div>
    );
  }
  return (
    <div>
      <ComponentTitle
        title="Hello World"
        description="Just a simple component"
      />
      <ComponentTitle2
        title="Hello World2"
        description="Just a simple component2"
      />
      <main>
        <button
          onClick={(e: Event) => {
            i++;
            log(`Button clicked ${i} times at path: ${ctx.path}`);
          }}
        >
          Do click
        </button>
        <hr />
        <b>Clicks: </b> {i}
        {i > 5 ? <div>more than 5 clicks!</div> : ""}
      </main>
      <a href="/test">go to test page</a>
    </div>
  );
});
