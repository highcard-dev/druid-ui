import { createClient } from "@druid-ui/client";
import { greet } from "example:custom/extension";

export const client = createClient(({ callTool, getValue, setValue }) => ({
  init() {
    setValue("$greeting", greet("SDK"));
    setValue("$initial", getValue("$input") ?? null);
  },
  async handleAction(action, params) {
    try {
      setValue(String(params.target), await callTool(action, params));
    } catch (error) {
      setValue(String(params.target), { error: String(error) });
    }
  },
}));
