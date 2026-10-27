import type { ToolProvider } from "@druid-ui/host";

/** An instance-owned demo filesystem, not deployment or local-disk access. */
export function createMemoryTools(
  fetchResource: typeof fetch,
  baseUrl: string,
): ToolProvider {
  const files = new Map([
    [
      "server.properties",
      "# Demo configuration\nmotd=Hello from Druid\nmax-players=20\n",
    ],
  ]);
  const checkPath = (path: unknown) => {
    if (path !== "server.properties")
      throw new Error("Only server.properties is exposed by this host");
    return path;
  };
  return {
    file_read(params, { signal }) {
      signal.throwIfAborted();
      return files.get(checkPath(params.path))!;
    },
    file_write(params, { signal }) {
      signal.throwIfAborted();
      const path = checkPath(params.path);
      if (typeof params.content !== "string")
        throw new Error("File content must be a string");
      files.set(path, params.content);
      return { saved: true };
    },
    async http_get(params, { signal }) {
      signal.throwIfAborted();
      if (params.path !== "status.json")
        throw new Error("Only status.json is exposed by this host");
      const response = await fetchResource(
        new URL("data/status.json", baseUrl),
        { signal, headers: { Accept: "application/json" } },
      );
      if (!response.ok)
        throw new Error(`HTTP request failed (${response.status})`);
      return response.json();
    },
  };
}
