import { DruidUI } from "../../../src/ui";
import { ViteHMR } from "../../../src/dev";

const druidUiElement = new DruidUI();
druidUiElement.sandbox = false;

druidUiElement.setAttribute("entrypoint", "/simple.bundled.js");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
