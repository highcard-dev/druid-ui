import { DruidUI } from "../../../src/main";

const druidUiElement = new DruidUI();

druidUiElement.setAttribute("entrypoint", "/transpiled/adder.js");
druidUiElement.rerender();

const app = document.getElementById("app");

console.log("Appending druid-ui element to #app");
console.log(druidUiElement);
app?.appendChild(druidUiElement);
