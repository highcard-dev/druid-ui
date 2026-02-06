import { DruidUI } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

console.log("Starting Druid UI");

const druidUiElement = new DruidUI();

druidUiElement.setAttribute("entrypoint", "/app.wasm");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
