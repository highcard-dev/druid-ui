import { DruidUI } from "../../../src/ui";
import { ViteHMR } from "../../../src/dev";

console.log("Starting simple example");

const druidUiElement = new DruidUI();

druidUiElement.setAttribute("entrypoint", "/adder.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

ViteHMR(druidUiElement);
