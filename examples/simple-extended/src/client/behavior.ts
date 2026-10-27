import type { ClientContext, ClientHandlers } from "@druid-ui/client";

export function createBehavior({
  callTool,
  setValue,
}: ClientContext): ClientHandlers {
  let loading = false;
  return {
    async handleAction(action, params) {
      if (action !== "FetchResource" || loading) return;
      loading = true;
      setValue("$status", "Loading…");
      try {
        const result = await callTool("http_get", params);
        setValue("$response", JSON.stringify(result, null, 2));
        setValue("$status", "Request complete");
      } catch (error) {
        setValue(
          "$status",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        loading = false;
      }
    },
  };
}
