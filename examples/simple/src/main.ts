import { DruidUI } from "../../../src/main";

const druidUiElement = new DruidUI();

druidUiElement.setAttribute("entrypoint", "/adder.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);
