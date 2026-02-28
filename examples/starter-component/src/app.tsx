import { type Context, createComponent } from "@druid-ui/component";

export const component = createComponent((ctx: Context) => {
  return (
    <div>
      <h1>Hello from Druid UI!</h1>
      <p>This is a component built with @druid-ui/build.</p>
      <p>Current path: {ctx.path}</p>
    </div>
  );
});
