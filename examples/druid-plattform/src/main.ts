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
    loadFileFromDeployment: PromiseToResult(async (path: string) => {
      console.log(`Loading file from deployment: ${path}`);
      // Implement your logic to load the file from deployment
      return "file content";
    }),
    saveFileToDeployment: PromiseToResult(
      async (path: string, content: string) => {
        console.log(
          `Saving file to deployment: ${path} with content: ${content}`
        );
        // Implement your logic to save the file to deployment
        return "success";
      }
    ),
  },
};
druidUiElement.setAttribute("entrypoint", "/druid.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
