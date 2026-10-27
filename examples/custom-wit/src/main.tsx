import { createRoot } from "react-dom/client";
import { Renderer, defineAction } from "@openuidev/react-lang";
import { openuiLibrary, ThemeProvider } from "@openuidev/react-ui";
import { z } from "zod";
import "@openuidev/react-ui/index.css";
import { OpenUIHost } from "@druid-ui/host";
import source from "./view.openui?url";
const library = openuiLibrary.extend({
  actions: {
    add: [
      defineAction({
        name: "Greet",
        description: "Call a typed WIT import",
        params: z.object({}),
      }),
    ],
  },
});
createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <OpenUIHost
      library={library}
      openUiSourceUrl={source}
      wasmUrl={`${import.meta.env.BASE_URL}client/index.wasm`}
      additionalImports={{
        "example:custom/extension": {
          greet: (name: string) => `Hello ${name} from custom WIT`,
        },
      }}
    >
      <Renderer.Content />
    </OpenUIHost>
  </ThemeProvider>,
);
