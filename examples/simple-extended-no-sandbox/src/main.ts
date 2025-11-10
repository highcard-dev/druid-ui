import { DruidUI } from "../../../src/ui";
import { ViteHMR } from "../../../src/dev";
import { PromiseToResult } from "../../../src/utils";

console.log("Starting simple example");

const druidUiElement = new DruidUI();
druidUiElement.extensionObject = {
  "druid:ui/extension": {
    requestGet: PromiseToResult(async (url: string) => {
      const res = await fetch(url);
      return res.text();
    }),
  },
};
druidUiElement.sandbox = false;
druidUiElement.setAttribute("entrypoint", "/extended.bundled.js");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
