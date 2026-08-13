import { DruidUI, PromiseToResult } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";
import manifest from "../fixtures/config-editor.manifest.json";
import serverProperties from "../fixtures/server.properties?raw";

const query = new URLSearchParams(window.location.search);
const fixtureManifest = structuredClone(manifest);
if (query.get("rawOnly") === "1") fixtureManifest.files[0]!.sections = [];

const files = new Map<string, string>([
  ["private/config-editor.manifest.json", JSON.stringify(fixtureManifest)],
  ["server.properties", serverProperties],
]);

const druidUiElement = new DruidUI();
druidUiElement.extensionObject = {
  "druid:ui/plattform": {
    request: PromiseToResult(async () => ""),
    loadFileFromDeployment: PromiseToResult(async (path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`Missing fixture file: ${path}`);
      return content;
    }),
    saveFileToDeployment: PromiseToResult(async (path: string, content: string) => {
      files.set(path, content);
      return "saved";
    }),
  },
};

const mode = query.get("mode");
const sandbox = mode === "wasm";
druidUiElement.setAttribute(
  "entrypoint",
  sandbox ? "/app.wasm" : "/app.bundled-raw.js",
);
if (!sandbox) druidUiElement.setAttribute("no-sandbox", "true");
druidUiElement.setAttribute("profile", "false");

document.getElementById("app")?.appendChild(druidUiElement);
ViteHMR(druidUiElement);

Object.assign(window, {
  __druidConfigEditorFixture: {
    mode: sandbox ? "wasm" : "raw",
    read(path: string) {
      return files.get(path);
    },
    replace(path: string, content: string) {
      files.set(path, content);
    },
  },
});
