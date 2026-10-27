import { useState } from "react";
import { defineAction } from "@openuidev/react-lang";
import { openuiLibrary, ThemeProvider } from "@openuidev/react-ui";
import "@openuidev/react-ui/index.css";
import { z } from "zod";
import { OpenUIHost } from "@druid-ui/host";
import documentUrl from "./settings.openui?url";

const settingsSchema = z.object({
  serverName: z.string().trim().min(1, "Enter a server name."),
  players: z.coerce.number().int().min(1).max(100),
  difficulty: z.enum(["peaceful", "normal", "hard"]),
});

const previewSettings = defineAction({
  name: "PreviewSettings",
  description: "Preview the current form values without saving them",
  params: z.object({
    serverName: z.string(),
    players: z.string(),
    difficulty: z.string(),
  }),
});

const library = openuiLibrary.extend({
  actions: { add: [previewSettings] },
});

export function App() {
  const [saved, setSaved] = useState<z.infer<typeof settingsSchema>>();
  const [preview, setPreview] =
    useState<z.infer<typeof previewSettings.params>>();

  return (
    <ThemeProvider>
      <main className="demo">
        <header className="demo-header">
          <span className="demo-badge">DRUID / OPENUI</span>
          <h1>A smaller UI runtime.</h1>
          <p>
            React renders the view. OpenUI Lang owns the form. A host tool
            handles save. WASM receives the custom preview action.
          </p>
        </header>
        <div className="demo-grid">
          <section className="demo-panel" aria-label="OpenUI preview">
            <OpenUIHost
              library={library}
              openUiSourceUrl={documentUrl}
              wasmUrl={`${import.meta.env.BASE_URL}client/index.wasm`}
              onAction={(event) => {
                if (event.type === "PreviewSettings") setPreview(event.params);
              }}
              toolProvider={{
                preview_settings: async (args, { signal }) => {
                  signal.throwIfAborted();
                  if (args.serverName === "fail")
                    throw new Error("Preview rejected by host");
                  return { message: `Previewing ${args.serverName}` };
                },
                save_settings: async (args) => {
                  const result = settingsSchema.safeParse(args);
                  if (!result.success)
                    throw new Error(result.error.issues[0]!.message);
                  setSaved(result.data);
                  return result.data;
                },
              }}
            />
          </section>
          <aside className="demo-panel inspector">
            <h2>Host receives</h2>
            <p>In-memory demo only. Reloading clears the saved values.</p>
            <h3>Custom action: PreviewSettings</h3>
            <pre aria-label="Preview settings">
              {preview
                ? JSON.stringify(preview, null, 2)
                : "No preview requested yet."}
            </pre>
            <h3>Mutation: save_settings</h3>
            <pre aria-label="Saved settings">
              {saved
                ? JSON.stringify(saved, null, 2)
                : "No settings saved yet."}
            </pre>
            <details>
              <summary>View OpenUI Lang</summary>
              <a href={documentUrl} target="_blank" rel="noreferrer">
                Open document source
              </a>
            </details>
          </aside>
        </div>
      </main>
    </ThemeProvider>
  );
}
