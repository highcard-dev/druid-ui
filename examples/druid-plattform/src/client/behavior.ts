import type { ClientContext, ClientHandlers } from "@druid-ui/client";

export function createBehavior({
  callTool,
  setValue,
}: ClientContext): ClientHandlers {
  let busy = false;
  const read = async () => {
    setValue(
      "$content",
      await callTool<string>("file_read", { path: "server.properties" }),
    );
  };
  const perform = async (run: () => Promise<void>, message: string) => {
    if (busy) return;
    busy = true;
    setValue("$status", "Working…");
    try {
      await run();
      setValue("$status", message);
    } catch (error) {
      setValue(
        "$status",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      busy = false;
    }
  };
  return {
    init: () => perform(read, "Configuration loaded"),
    async handleAction(action, params) {
      if (action === "ReadFile") await perform(read, "Configuration loaded");
      if (action === "WriteFile")
        await perform(async () => {
          await callTool("file_write", {
            path: "server.properties",
            content: params.content!,
          });
        }, "Saved in memory");
      if (action === "FetchStatus")
        await perform(async () => {
          setValue(
            "$http",
            JSON.stringify(
              await callTool("http_get", { path: "status.json" }),
              null,
              2,
            ),
          );
        }, "Request complete");
    },
  };
}
