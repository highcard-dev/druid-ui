import { useState } from "react";
import { defineAction } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui";
import { OpenUIHost } from "@druid-ui/host";
import { z } from "zod";
import source from "./view.openui?url";
import { createHttpTools } from "./tools";

const library = openuiLibrary.extend({
  actions: {
    add: [
      defineAction({
        name: "FetchResource",
        description: "Fetch JSON through a named async host tool",
        params: z.object({ path: z.string() }),
      }),
    ],
  },
});
export function App() {
  const [tools] = useState(() =>
    createHttpTools(
      globalThis.fetch,
      new URL(import.meta.env.BASE_URL, window.location.origin).href,
    ),
  );
  return (
    <OpenUIHost
      library={library}
      openUiSourceUrl={source}
      wasmUrl={`${import.meta.env.BASE_URL}client/index.wasm`}
      toolProvider={tools}
    />
  );
}
