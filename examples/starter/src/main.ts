/// <reference types="vite/client" />
import { DruidUI } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

console.log("Starting Druid UI");

const druidUiElement = new DruidUI();

if (import.meta.env.DEV) {
  // Dev mode: use raw (no sandbox) for speed
  druidUiElement.sandbox = false;
  druidUiElement.setAttribute("entrypoint", "/app.bundled.js");
} else {
  // Production: use WASM sandbox
  druidUiElement.setAttribute("entrypoint", "/app.wasm");
}

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
