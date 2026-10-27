import type { ToolProvider } from "@druid-ui/host";

export function createNavigationTools(
  browser: Pick<Window, "location" | "history">,
): ToolProvider {
  return {
    get_location: (_params, { signal }) => {
      signal.throwIfAborted();
      return browser.location.pathname;
    },
    navigate: (params, { signal }) => {
      signal.throwIfAborted();
      if (params.path !== "/" && params.path !== "/test")
        throw new Error("Only / and /test are demo routes");
      browser.history.pushState(null, "", params.path);
      return browser.location.pathname;
    },
  };
}
