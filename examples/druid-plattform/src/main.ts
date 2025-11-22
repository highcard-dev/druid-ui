import { DruidUI } from "../../../src/ui";
import { ViteHMR } from "../../../src/dev";
import { PromiseToResult } from "../../../src/utils";

console.log("Starting simple example");

const druidUiElement = new DruidUI();
druidUiElement.extensionObject = {
  "druid:ui/plattform": {
    request: PromiseToResult(
      async (
        url: string,
        method: string,
        body: string,
        header: Array<[string, string]>
      ) => {
        const res = await fetch(url);
        console.log({ url, method, body, header });
        return res.text();
      }
    ),
  },
};
druidUiElement.setAttribute("entrypoint", "/druid.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
