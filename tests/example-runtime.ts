import type {
  ClientContext,
  ClientHandlers,
  JsonValue,
} from "@druid-ui/client";
import type { loadWasmClient } from "../packages/host/src/wasm";

// Exercise authored views and guest behavior together. Real component compilation
// and native async transport are covered by the SDK's WASM integration test.
export function emulateBehavior(
  createBehavior: (context: ClientContext) => ClientHandlers,
): typeof loadWasmClient {
  return async (_url, _signal, state, options) => {
    if (!options?.session)
      throw new Error("Example requires an instance tool session");
    const handlers = createBehavior({
      async callTool<T extends JsonValue>(
        operation: string,
        params: Record<string, JsonValue>,
      ) {
        return (await options.session!.run(operation, params)) as T;
      },
      getValue(name) {
        const value = state.getValue(name);
        return value === undefined ? undefined : JSON.parse(value);
      },
      setValue(name, value) {
        state.setValue(name, JSON.stringify(value));
      },
      log() {},
    });
    await handlers.init?.();
    return {
      dispatch(action, params) {
        void handlers.handleAction(action, params as Record<string, JsonValue>);
      },
    };
  };
}
