/// <reference types="@druid-ui/component/types" />
/// <reference types="@druid-ui/component/jsx" />
/** @jsx d */
import { Context, d, Event, log, createComponent } from "@druid-ui/component";

let i = 0;

interface ComponentTitle {
  title: string;
  description: string;
}

let t = 0;
const ComponentTitle = {
  init: () => {
    log("ComponentTitle init called");
    t++;
  },
  view: ({ title, description }: ComponentTitle) => (
    <div>
      <h1>{title}</h1>
      <h2>{description}</h2>
    </div>
  ),
};

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
      {["1", "2", "3"].map((val) => (
        <div>{val}</div>
      ))}
      <ComponentTitle
        title="Hello Worl1d"
        description="Just a simple component"
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
        {"" + t}
        <hr />
        <b>Clicks: </b> {i}
        {i > 5 ? <div>more than 5 clicks!</div> : ""}
      </main>
      <a href="/test">go to test page</a>
    </div>
  );
});
