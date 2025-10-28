import { DruidUI } from "../../../src/ui";

const druidUiElement = new DruidUI();

druidUiElement.setAttribute("entrypoint", "/adder.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);
