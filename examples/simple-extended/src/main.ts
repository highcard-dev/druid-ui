import { DruidUI, PromiseToResult } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

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
druidUiElement.setAttribute("entrypoint", "/extended.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
