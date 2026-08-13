/// <reference types="@druid-ui/plattform" />
/// <reference types="@druid-ui/component/jsx" />
import { Context, createComponent, log } from "@druid-ui/component";
import { request, loadFileFromDeployment } from "@druid-ui/plattform";
let content = "test";
export const component = createComponent((ctx: Context) => {
  log("Druid Plattform Component");
  return (
    <div>
      <button
        onClick={async () => {
          content = (await loadFileFromDeployment("url")) as string;
        }}
      >
        request
      </button>
      <div>{content}</div>
    </div>
  );
});
