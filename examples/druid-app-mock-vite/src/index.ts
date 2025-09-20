import { LuaEngine } from "wasmoon";
import { DruidUI, type RerenderFn } from "../../../src/main";

// Check if druid-ui already exists, if so, do nothing
const root = document.getElementById("app");
let d = root?.querySelector("druid-ui") as DruidUI | null;

if (!d && root) {
  d = document.createElement("druid-ui") as DruidUI;

  const wrappedfetch =
    (rerender: RerenderFn) => async (url: string, requestInit: RequestInit) => {
      const res = await fetch(url, requestInit);

      const contentType = res.headers.get("content-type");

      let promise: Promise<any>;
      if (contentType && contentType.includes("application/json")) {
        promise = res.json();
      } else if (contentType && contentType.includes("text/")) {
        promise = res.text();
      } else if (
        contentType &&
        contentType.includes("application/octet-stream")
      ) {
        promise = res.arrayBuffer();
      } else if (contentType && contentType.includes("image/")) {
        promise = res.blob();
      } else {
        // fallback
        promise = res.text(); // or res.blob(), depending on your use case
      }
      return promise.finally(() => setTimeout(rerender, 0));
    };

  d.addEventListener("init", (e) => {
    const event = e as CustomEvent<{ lua: LuaEngine }>;

    const lua = event.detail.lua;

    lua.global.set("loadFileFromDeployment", async (file: string) => {
      const response = await fetch(file);
      return response.text().finally(() => setTimeout(d?.rerender.bind(d), 0));
    });
    lua.global.set(
      "setFileFromDeployment",
      async (file: string, content: string) => {
        //this will always fail
        await fetch(file, {
          method: "PUT",
          body: content,
        });
      }
    );

    lua.global.set("dmethods", {
      request: wrappedfetch(d?.rerender.bind(d)),
    });
  });
  d.setAttribute("entrypoint", "simple.lua");
  d.setAttribute("path", "/");

  d.setAttribute(
    "css",
    "https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
  );

  d.setAttribute(
    "style",
    `:host {
  --pico-text-selection-color: rgba(244, 93, 44, 0.25) !important;
  --pico-primary: #bd3c13 !important;
  --pico-primary-background: #d24317 !important;
  --pico-primary-underline: rgba(189, 60, 19, 0.5) !important;
  --pico-primary-hover: #942d0d !important;
  --pico-primary-hover-background: #bd3c13 !important;
  --pico-primary-focus: rgba(244, 93, 44, 0.5) !important;
  --pico-primary-inverse: #fff !important;
}`
  );

  root.appendChild(d);
}

//vite hot reloading
if (import.meta.hot) {
  import.meta.hot.on("lua-update", (data) => {
    //just file name not path
    const fileName = data?.file.split("/").pop();

    console.log("Lua files updated, rerendering...", fileName);
    d?.reload(fileName);
  });
}
