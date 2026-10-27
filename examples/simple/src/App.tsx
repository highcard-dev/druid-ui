import { useEffect, useReducer, useState } from "react";
import { defineAction } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui";
import { OpenUIHost } from "@druid-ui/host";
import { z } from "zod";
import source from "./view.openui?url";
import { createNavigationTools } from "./tools";

const library = openuiLibrary.extend({
  actions: {
    add: [
      defineAction({
        name: "Increment",
        description: "Increment the WASM counter",
        params: z.object({}),
      }),
      defineAction({
        name: "Navigate",
        description: "Navigate through the trusted host",
        params: z.object({ path: z.string() }),
      }),
    ],
  },
});

export function App() {
  const [tools] = useState(() => createNavigationTools(window));
  const [reloadKey, reload] = useReducer((value) => value + 1, 0);
  useEffect(() => {
    // Browser Back/Forward starts a fresh guest at the current route.
    window.addEventListener("popstate", reload);
    return () => window.removeEventListener("popstate", reload);
  }, []);
  return (
    <OpenUIHost
      library={library}
      openUiSourceUrl={source}
      wasmUrl={`${import.meta.env.BASE_URL}client/index.wasm`}
      toolProvider={tools}
      reloadKey={reloadKey}
    />
  );
}
