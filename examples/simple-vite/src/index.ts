import { DruidUI } from "../../../src/main";

const d = document.createElement("druid-ui") as DruidUI;

d.setAttribute("entrypoint", "simple.lua");
d.setAttribute("path", "/");
const root = document.getElementById("app");
root?.appendChild(d);
