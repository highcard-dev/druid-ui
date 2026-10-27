import { expect, it, vi } from "vitest";
import { createToolSession, type ToolProvider } from "./tools";
import type { JsonValue } from "@druid-ui/client/types";

it("awaits concurrent host calls independently with the instance signal", async () => {
  const controller = new AbortController();
  let finish!: (value: string) => void;
  const slow = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const session = createToolSession(controller.signal, () => ({
    slow,
    fast: async () => "fast",
  }));
  const first = session.call("slow", "{}");
  await expect(session.call("fast", "{}")).resolves.toBe('"fast"');
  finish("slow");
  await expect(first).resolves.toBe('"slow"');
  expect(slow).toHaveBeenCalledWith({}, { signal: controller.signal });
  expect(session).not.toHaveProperty("attach");
});

it("rejects unknown/prototype tools, invalid JSON and nonobject parameters", async () => {
  const session = createToolSession(new AbortController().signal, () => ({}));
  await expect(session.call("missing", "{}")).rejects.toContain(
    "Unknown host tool",
  );
  await expect(session.call("toString", "{}")).rejects.toContain(
    "Unknown host tool",
  );
  for (const json of ["[]", "null", "42", "invalid"])
    await expect(session.call("missing", json)).rejects.toBeTypeOf("string");
});

it("immediately rejects aborted work even if the handler ignores cancellation", async () => {
  const controller = new AbortController();
  let finish!: (value: string) => void;
  const old = createToolSession(controller.signal, () => ({
    load: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  }));
  const pending = old.run("load", {});
  const rejection = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  controller.abort();
  await rejection;
  finish("stale");
  const next = createToolSession(new AbortController().signal, () => ({
    load: async () => "new",
  }));
  await expect(next.call("load", "{}")).resolves.toBe('"new"');
  await expect(old.run("load", {})).rejects.toMatchObject({
    name: "AbortError",
  });
});

it("uses the latest registry, cleans abort listeners and serializes results/errors", async () => {
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  let tools: ToolProvider = { save: async () => "old" };
  const session = createToolSession(controller.signal, () => tools);
  tools = {
    save: () => undefined,
    fail: () => {
      throw new Error("Denied");
    },
    cyclic: () => {
      const value: Record<string, JsonValue> = {};
      value.self = value;
      return value;
    },
  };
  await expect(session.run("save", {})).resolves.toBeNull();
  await expect(session.call("fail", "{}")).rejects.toBe("Denied");
  await expect(session.call("cyclic", "{}")).rejects.toContain("circular");
  expect(remove).toHaveBeenCalledTimes(3);
});
