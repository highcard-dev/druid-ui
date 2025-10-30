import { DruidUI } from "../../../src/ui";

const druidUiElement = new DruidUI();

druidUiElement.setAttribute("entrypoint", "/adder.wasm");
druidUiElement.setAttribute("profile", "true");

const app = document.getElementById("app");

app?.appendChild(druidUiElement);

//vite hot reloading
if (import.meta.hot) {
  console.log("HMR enabled");
  import.meta.hot.on("ui-update", (data) => {
    //just file name not path
    const fileName = data?.file.split("/").pop();
    console.log("UI update for file:", fileName);

    druidUiElement.reloadComponent();
  });
}
