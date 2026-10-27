import { useState } from "react";
import {
  defineAction,
  defineComponent,
  useSetFieldValue,
} from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui";
import { OpenUIHost } from "@druid-ui/host";
import { z } from "zod";
import source from "./view.openui?url";
import { createMemoryTools } from "./tools";

// A custom React component receives the evaluated document value rather than
// a reactive form descriptor. The trusted host controls the textarea and label.
const ConfigEditor = defineComponent({
  name: "ConfigEditor",
  props: z.object({ content: z.string() }),
  description:
    "Edit complete configuration text, preserving comments and unknown keys",
  component: ({ props }) => {
    const setValue = useSetFieldValue();
    return (
      <label htmlFor="demo-config">
        server.properties
        <textarea
          id="demo-config"
          rows={8}
          style={{ width: "100%", fontFamily: "monospace" }}
          value={props.content}
          onChange={(event) =>
            setValue(undefined, undefined, "$content", event.target.value)
          }
        />
      </label>
    );
  },
});
const library = openuiLibrary.extend({
  components: { add: [ConfigEditor] },
  actions: {
    add: [
      defineAction({
        name: "ReadFile",
        description: "Read the demo configuration",
        params: z.object({}),
      }),
      defineAction({
        name: "WriteFile",
        description: "Save the edited configuration",
        params: z.object({ content: z.string() }),
      }),
      defineAction({
        name: "FetchStatus",
        description: "Fetch the demo service status",
        params: z.object({}),
      }),
    ],
  },
});
export function App() {
  const [tools] = useState(() =>
    createMemoryTools(
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
