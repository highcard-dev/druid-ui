import type { ClientContext, ClientHandlers } from "@druid-ui/client";

export function createBehavior({
  callTool,
  getValue,
  setValue,
}: ClientContext): ClientHandlers {
  return {
    async init() {
      setValue("$count", 0);
      try {
        setValue("$path", await callTool<string>("get_location", {}));
      } catch (error) {
        setValue("$status", String(error));
      }
    },
    async handleAction(action, params) {
      if (action === "Increment")
        setValue("$count", (getValue<number>("$count") ?? 0) + 1);
      if (action === "Navigate") {
        try {
          setValue("$path", await callTool<string>("navigate", params));
        } catch (error) {
          setValue("$status", String(error));
        }
      }
    },
  };
}
