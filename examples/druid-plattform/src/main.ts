import { DruidUI, PromiseToResult } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

/**
 * Platform Example - Full Extension API
 *
 * Demonstrates a complete platform integration with multiple extension functions.
 * Shows how to build a full application platform on top of Druid UI.
 */

const druidUiElement = new DruidUI();

// Full platform extension API
druidUiElement.extensionObject = {
  "druid:ui/plattform": {
    // HTTP request handler
    request: PromiseToResult(
      async (
        url: string,
        method: string,
        body: string,
        header: Array<[string, string]>,
      ) => {
        const res = await fetch(url, { method, body, headers: header });
        return res.text();
      },
    ),
    // File system integration
    loadFileFromDeployment: PromiseToResult(async (path: string) => {
      console.log(`Loading file: ${path}`);
      // Implement your file loading logic here
      return "file content";
    }),
    saveFileToDeployment: PromiseToResult(
      async (path: string, content: string) => {
        console.log(`Saving file: ${path}`);
        // Implement your file saving logic here
        return "success";
      },
    ),
  },
};

druidUiElement.setAttribute("entrypoint", "/druid.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");
app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
