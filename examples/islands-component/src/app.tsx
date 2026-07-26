import { type Context, createComponent, island } from "@druid-ui/component";

let clicks = 0;

export const component = createComponent((ctx: Context) => (
  <div>
    <h2>Druid UI islands</h2>
    {island("IslandThemeProbe", { label: "SPA provider" })}
    {island("Card", { className: "mt-3 max-w-md", size: "sm" }, [
      "This card is rendered by the SPA React tree.",
    ])}
    <p>Current path: {ctx.path}</p>
    {island(
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
