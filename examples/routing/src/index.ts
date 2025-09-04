import { DruidUI, HttpFileLoader } from "../../../src/main";

const d = document.createElement("druid-ui") as DruidUI;
const routesEl = document.getElementById("routes");

d.fileloader = new HttpFileLoader({
  type: "bearer",
  token: "your_token_here",
});

d.setAttribute("entrypoint", "simple.lua");
const root = document.getElementById("app");
root?.appendChild(d);

d.addEventListener("mount", ((event: CustomEvent) => {
  if (routesEl) {
    const routes = d.routes;

    if (!routes) {
      routesEl.innerHTML = `<p>No routes available.</p>`;
      return;
    }
    routesEl.innerHTML = `
    <h3>Available routes:</h3>
    <ul>
      ${Object.keys(routes)
        .map((key) => `<li><a href="${key}"><strong>${key}</strong></a></li>`)
        .join("")}
    </ul>
  `;
  }
}) as EventListener);
