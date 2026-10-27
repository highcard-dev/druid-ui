import { defineAction } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui";
import { OpenUIHost, type ToolProvider } from "@druid-ui/host";
import { z } from "zod";
import source from "./view.openui?url";

const library = openuiLibrary.extend({
  actions: {
    add: [
      defineAction({
        name: "Increment",
        description: "Increment the Rust counter",
        params: z.object({}),
      }),
      defineAction({
        name: "Greet",
        description: "Call an asynchronous host tool from Rust",
        params: z.object({
          name: z.string(),
          target: z.enum(["$first", "$second"]),
        }),
      }),
    ],
  },
});
const tools: ToolProvider = {
  async greet(params, { signal }) {
    signal.throwIfAborted();
    if (typeof params.name !== "string") throw new Error("A name is required");
    await Promise.resolve();
    signal.throwIfAborted();
    if (params.name === "fail")
      throw new Error("Greeting rejected by the host");
    return { message: `Hello, ${params.name}, from a Rust client!` };
  },
};
export function App() {
  return (
    <OpenUIHost
      library={library}
      openUiSourceUrl={source}
      wasmUrl={`${import.meta.env.BASE_URL}client/index.wasm`}
      toolProvider={tools}
    />
  );
}
