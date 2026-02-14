import { DruidUI, PromiseToResult } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

/**
 * Extended Example - WASM Sandbox with Extensions
 *
 * Demonstrates how to extend Druid UI with custom host functions.
 * The component can call back into the host environment.
 */

const druidUiElement = new DruidUI();

// Provide extension object with custom functions
druidUiElement.extensionObject = {
  "druid:ui/extension": {
    // Async function wrapped with PromiseToResult
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
