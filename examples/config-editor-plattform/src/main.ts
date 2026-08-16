import { DruidUI, PromiseToResult } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";
import manifest from "../fixtures/config-editor.manifest.json";
import serverProperties from "../fixtures/server.properties?raw";

const query = new URLSearchParams(window.location.search);
const fixtureManifest = structuredClone(manifest);
if (query.get("rawOnly") === "1") fixtureManifest.files[0]!.sections = [];
const serverPropertiesPath =
  query.get("templateOnly") === "1"
    ? "server.properties.scroll_template"
    : "server.properties";

const files = new Map<string, string>([
  ["private/config-editor.manifest.json", JSON.stringify(fixtureManifest)],
  [serverPropertiesPath, serverProperties],
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
    saveFileToDeploymentIfMatch: PromiseToResult(
      async (path: string, content: string, expectedFingerprint: string) => {
        const remote = files.get(path);
        if (remote === undefined && expectedFingerprint === "missing") {
          files.set(path, content);
          const savedDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
          const fingerprint = Array.from(new Uint8Array(savedDigest), (byte) =>
            byte.toString(16).padStart(2, "0")
          ).join("");
          return JSON.stringify({ status: "saved", fingerprint });
        }
        if (remote === undefined) throw new Error(`Missing fixture file: ${path}`);
        const bytes = new TextEncoder().encode(remote);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const remoteFingerprint = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0")
        ).join("");
        if (remoteFingerprint !== expectedFingerprint) {
          return JSON.stringify({ status: "conflict", remote, fingerprint: remoteFingerprint });
        }
        files.set(path, content);
        const savedDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
        const fingerprint = Array.from(new Uint8Array(savedDigest), (byte) =>
          byte.toString(16).padStart(2, "0")
        ).join("");
        return JSON.stringify({ status: "saved", fingerprint });
      },
    ),
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
