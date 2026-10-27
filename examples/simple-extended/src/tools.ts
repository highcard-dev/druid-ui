import type { ToolProvider } from "@druid-ui/host";

export function createHttpTools(
  fetchResource: typeof fetch,
  baseUrl: string,
): ToolProvider {
  return {
    async http_get(params, { signal }) {
      signal.throwIfAborted();
      if (params.path !== "message.json" && params.path !== "missing.json")
        throw new Error(
          "Only message.json and missing.json are exposed by this host",
        );
      const response = await fetchResource(
        new URL(`data/${params.path}`, baseUrl),
        { signal, headers: { Accept: "application/json" } },
      );
      if (!response.ok)
        throw new Error(`HTTP request failed (${response.status})`);
      return response.json();
    },
  };
}
