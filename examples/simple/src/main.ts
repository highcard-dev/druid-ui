import { DruidUI } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

console.log("Starting simple example");

const druidUiElement = new DruidUI();

druidUiElement.setAttribute("entrypoint", "/simple.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
