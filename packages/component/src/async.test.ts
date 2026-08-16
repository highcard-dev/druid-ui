import { describe, expect, it } from "vitest";
import { createAsyncBridge } from "./async.js";

const outcomeWithin = async <T>(promise: Promise<T>) =>
  await Promise.race([
    promise.then(
      (value) => ({ status: "resolved" as const, value }),
      (error: unknown) => ({ status: "rejected" as const, error }),
    ),
    new Promise<{ status: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ status: "timeout" }), 50),
    ),
  ]);

describe("createAsyncBridge", () => {
  it("buffers a successful callback that arrives before registration", async () => {
    const bridge = createAsyncBridge();
    const result = bridge.wrap<string>(() => {
      bridge.complete("early-ok", { tag: "ok", val: "ready" });
      return "early-ok";
    })();

    await expect(outcomeWithin(result)).resolves.toEqual({
      status: "resolved",
      value: "ready",
    });
  });

  it("buffers an error callback that arrives before registration", async () => {
    const bridge = createAsyncBridge();
    const result = bridge.wrap<string>(() => {
      bridge.complete("early-error", { tag: "err", val: "Missing file" });
      return "early-error";
    })();

    const outcome = await outcomeWithin(result);
    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") {
      expect(outcome.error).toEqual(new Error("Missing file"));
    }
  });
});
