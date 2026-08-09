import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTranspile } from "./transpile";

describe("loadTranspile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects instead of waiting forever when its worker never responds", async () => {
    class HangingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;

      postMessage() {}
      terminate() {}
    }

    vi.useFakeTimers();
    vi.stubGlobal("Worker", HangingWorker);
    vi.stubGlobal("crypto", {
      subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
    });
    vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem: vi.fn() });

    const transpile = loadTranspile(new ArrayBuffer(1));
    const rejection = expect(transpile).rejects.toThrow(
      "transpile worker timed out",
    );
    await vi.advanceTimersByTimeAsync(15_000);

    await rejection;
  });
});
