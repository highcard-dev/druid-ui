import { DruidUI } from "@druid-ui/host";
import { ViteHMR } from "@druid-ui/vite/client";

const druidUiElement = new DruidUI();
druidUiElement.sandbox = false;

druidUiElement.setAttribute("entrypoint", "/simple.bundled-raw.js");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
