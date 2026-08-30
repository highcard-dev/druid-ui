import { afterEach, describe, expect, it, vi } from "vitest";
import { DRUID_UI_ERROR_EVENT, DruidUI } from "./ui";

describe("DruidUI loading lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not show a transpile state while idle", () => {
    const element = new DruidUI();
    document.body.appendChild(element);

    expect(
      element.shadowRoot?.querySelector("[data-druid-ui-status]"),
    ).not.toHaveAttribute("data-state");
    expect(element.shadowRoot?.textContent).not.toContain("Transpiling Druid UI");
  });

  it("shows real transpile work and surfaces worker failure", async () => {
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
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
    });

    const element = new DruidUI();
    const onError = vi.fn();
    element.addEventListener(DRUID_UI_ERROR_EVENT, onError);
    document.body.appendChild(element);
    element.buffer = new ArrayBuffer(1);

    const status = element.shadowRoot?.querySelector(
      "[data-druid-ui-status]",
    );
    expect(status).toHaveAttribute("data-state", "loading");
    expect(status).toHaveTextContent("Transpiling Druid UI");

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(status).toHaveAttribute("data-state", "error");
    expect(status).toHaveTextContent("Failed to transpile Druid UI");
    expect(status).toHaveTextContent("transpile worker timed out");
    expect(onError).toHaveBeenCalledOnce();
  });
});
