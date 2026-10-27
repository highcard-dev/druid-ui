import { beforeEach, expect, it, vi } from "vitest";
import { createClient, type ClientContext } from "./index";
import { call, log } from "druid:openui/host";
vi.mock("druid:openui/host", () => ({ call: vi.fn(), log: vi.fn() }));
vi.mock("druid:openui/state", () => ({ getValue: vi.fn(), setValue: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

it("awaits a direct host result and delivers async action results", async () => {
  const values: unknown[] = [];
  const client = createClient(({ callTool }) => ({
    async handleAction() {
      values.push(await callTool("echo", { value: 42 }));
    },
  }));
  vi.mocked(call).mockResolvedValue('{"value":42}');
  await client.handleAction("Echo", "{}");
  expect(values).toEqual([{ value: 42 }]);
  expect(call).toHaveBeenCalledWith("echo", '{"value":42}');
  expect(client).not.toHaveProperty("complete");
});

it("awaits concurrent calls independently without SDK request IDs", async () => {
  let context!: ClientContext;
  const client = createClient((api) => {
    context = api;
    return { handleAction() {} };
  });
  let finish!: (json: string) => void;
  vi.mocked(call).mockImplementation(async (operation) => {
    if (operation === "first")
      return new Promise((resolve) => {
        finish = resolve;
      });
    return "null";
  });
  const first = context.callTool("first", {});
  const second = context.callTool("second", {});
  await expect(second).resolves.toBeNull();
  finish('"first"');
  await expect(first).resolves.toBe("first");
  vi.mocked(call).mockRejectedValue("Denied");
  await expect(context.callTool("broken", {})).rejects.toThrow("Denied");
});

it("rejects malformed JSON results and synchronous host failures", async () => {
  const contexts: ClientContext[] = [];
  const make = () =>
    createClient((api) => {
      contexts.push(api);
      return { handleAction() {} };
    });
  make();
  make();
  vi.mocked(call).mockResolvedValueOnce("invalid").mockResolvedValueOnce("2");
  const first = contexts[0]!.callTool("one", {});
  const second = contexts[1]!.callTool("two", {});
  const rejected = expect(first).rejects.toThrow();
  await rejected;
  await expect(second).resolves.toBe(2);
  vi.mocked(call).mockImplementation(() => {
    throw new Error("Host unavailable");
  });
  await expect(contexts[0]!.callTool("one", {})).rejects.toThrow(
    "Host unavailable",
  );
});

it("reports malformed actions and rejected async handlers instead of unhandled rejections", async () => {
  const onError = vi.fn();
  const client = createClient(() => ({
    onError,
    async handleAction() {
      throw new Error("Action failed");
    },
  }));
  await client.handleAction("Bad", "invalid");
  await client.handleAction("Bad", "{}");
  expect(onError).toHaveBeenCalledTimes(2);
  expect(log).not.toHaveBeenCalled();
});
