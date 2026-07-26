import { type Context, createComponent, react } from "@druid-ui/component";

let clicks = 0;

export const component = createComponent((ctx: Context) => (
  <div>
    <h2>Druid UI React interop</h2>
    {react("DruidReactThemeProbe", { label: "SPA provider" })}
    {react("Card", { className: "mt-3 max-w-md", size: "sm" }, [
      "This card is rendered by the SPA React tree.",
    ])}
    <p>Current path: {ctx.path}</p>
    {react(
      "Button",
      {
        variant: "default",
        size: "sm",
        onClick: () => {
          clicks += 1;
        },
      },
      `Clicked ${clicks} ${clicks === 1 ? "time" : "times"}`,
    )}
  </div>
));
