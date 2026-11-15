import { createRoot } from "react-dom/client";
import { Renderer } from "@openuidev/react-lang";
import { OpenUIHost } from "@druid-ui/host";
import { library } from "./library";
import checksDocument from "./checks.openui?url";
import invadersDocument from "./invaders.openui?url";
import "./style.css";
import "./invaders.css";

const checks = new URLSearchParams(window.location.search).has("checks");
const invaders = new URLSearchParams(window.location.search).has("invaders");

createRoot(document.getElementById("root")!).render(
  <OpenUIHost
    library={library}
    openUiSourceUrl={
      invaders
        ? invadersDocument
        : checks
          ? checksDocument
          : import.meta.env.BASE_URL + "client/index.openui"
    }
    wasmUrl={import.meta.env.BASE_URL + "client/index.wasm"}
  >
    <Renderer.Content />
  </OpenUIHost>,
);
