import type { JsonValue } from "@druid-ui/client/types";

export type HostTool = (
  params: Record<string, JsonValue>,
  context: { signal: AbortSignal },
) => JsonValue | void | Promise<JsonValue | void>;
export type ToolProvider = Record<string, HostTool>;
export interface ToolSession {
  run(operation: string, params: Record<string, JsonValue>): Promise<JsonValue>;
  call(operation: string, params: string): Promise<string>;
}

export function createToolSession(
  signal: AbortSignal,
  tools: () => ToolProvider,
): ToolSession {
  const run = async (
    operation: string,
    params: Record<string, JsonValue>,
  ): Promise<JsonValue> => {
    signal.throwIfAborted();
    const provider = tools();
    if (!Object.hasOwn(provider, operation))
      throw new Error(`Unknown host tool: ${operation}`);
    const handler = provider[operation]!;
    let abort!: () => void;
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
    });
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => {
          signal.throwIfAborted();
          return handler(params, { signal });
        }),
        cancelled,
      ]);
      signal.throwIfAborted();
      return JSON.parse(JSON.stringify(result ?? null));
    } finally {
      signal.removeEventListener("abort", abort);
    }
  };
  return {
    run,
    async call(operation, json) {
      try {
        const params: unknown = JSON.parse(json);
        if (!params || typeof params !== "object" || Array.isArray(params))
          throw new Error("Tool parameters must be a JSON object");
        return JSON.stringify(
          await run(operation, params as Record<string, JsonValue>),
        );
      } catch (error) {
        // WIT's result<string, string> lowers a thrown string to its error arm.
        throw error instanceof Error ? error.message : String(error);
      }
    },
  };
}
