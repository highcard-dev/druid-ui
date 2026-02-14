import { DruidUI, PromiseToResult } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

/**
 * Extended Example - No Sandbox with Extensions
 *
 * Same as extended example but without WASM for faster development.
 * Demonstrates custom host functions in no-sandbox mode.
 */

const druidUiElement = new DruidUI();

// Provide extension object with custom functions
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
