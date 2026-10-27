import { call, log } from "druid:openui/host";
import { getValue, setValue } from "druid:openui/state";
import type { ClientExports, JsonValue } from "./types";
export type { ClientExports, JsonValue } from "./types";

export interface ClientContext {
  callTool<T extends JsonValue = JsonValue>(
    operation: string,
    params: Record<string, JsonValue>,
  ): Promise<T>;
  getValue<T extends JsonValue = JsonValue>(name: string): T | undefined;
  setValue(name: string, value: JsonValue): void;
  log(message: string): void;
}
export interface ClientHandlers {
  init?(): void | Promise<void>;
  handleAction(
    action: string,
    params: Record<string, JsonValue>,
  ): void | Promise<void>;
  onError?(error: unknown): void;
}
export function createClient(
  setup: (context: ClientContext) => ClientHandlers,
): ClientExports {
  const context: ClientContext = {
    async callTool<T extends JsonValue>(
      operation: string,
      params: Record<string, JsonValue>,
    ): Promise<T> {
      try {
        return JSON.parse(await call(operation, JSON.stringify(params))) as T;
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    getValue<T extends JsonValue>(name: string): T | undefined {
      const json = getValue(name);
      return json === undefined ? undefined : JSON.parse(json);
    },
    setValue: (name, value) => setValue(name, JSON.stringify(value)),
    log,
  };
  const handlers = setup(context);
  const report = (error: unknown) => {
    if (handlers.onError) handlers.onError(error);
    else
      log(
        `Unhandled client error: ${error instanceof Error ? error.message : String(error)}`,
      );
  };
  const run = async (operation: () => void | Promise<void>) => {
    try {
      await operation();
    } catch (error) {
      report(error);
    }
  };
  return {
    async init() {
      await run(() => handlers.init?.());
    },
    async handleAction(action, params) {
      await run(() => handlers.handleAction(action, JSON.parse(params)));
    },
  };
}
