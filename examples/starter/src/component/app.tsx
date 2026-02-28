import { type Context, type Event, createComponent } from "@druid-ui/component";

let clickCount = 0;

export const component = createComponent((ctx: Context) => {
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
