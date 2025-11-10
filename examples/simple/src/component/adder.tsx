/// <reference types="../../../../generated/types/guest/import/druid-ui.d.ts" />
/// <reference types="../../../../src/component/jsx.d.ts" />
/** @jsx d */
import {
  Context,
  d,
  Event,
  log,
  fetch,
  createComponent,
} from "druid-ui/component";

//prevent tree shaking

let i = 0;

const ComponentV2 = {
  view: ({ title, description }: any) => (
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
const t = async () => {
  log("Starting fetch poll...");
  const res = await fetch("https://api.github.com");
  log(res);
  log("Fetch poll set up.");
};

export const component = createComponent((ctx: Context) => {
  t();
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
    <div class="hello">
      <h2>lol</h2>
      <main>
        I can give you speed!
        <input
          type="text"
          onChange={(e: Event) => log(`Input changed: ${e.value()}`)}
        />
        <button
          onClick={(e: Event) => {
            i++;
          }}
        >
          test
        </button>
        uut!!{i}
        <ComponentV2 title="This is it!" description="newschool" />
        <ComponentV3 title="This is it!" description="newschool" />
        {i > 5 && <div>more than 5 clicks!</div>}
      </main>
      <a href="/test">go to test</a>
      Hello!
    </div>
  );
});
