import { type Context, createComponent } from "@druid-ui/component";

export const component = createComponent((ctx: Context) => {
  return (
    <div>
      <h1>Hello from Druid UI!</h1>
      <p>This is a simple component built with @druid-ui/build only.</p>
      <p>Current path: {ctx.path}</p>
      <p>Watch mode is working!</p>
    </div>
  );
});
