import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import source from "./view.openui?raw";
import { createBehavior } from "./client/behavior";
import { createNavigationTools } from "./tools";
import { loadWasmClient } from "../../../packages/host/src/wasm";
import { emulateBehavior } from "../../../tests/example-runtime";
vi.mock("../../../packages/host/src/wasm", () => ({ loadWasmClient: vi.fn() }));
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(source)),
  );
  vi.mocked(loadWasmClient).mockImplementation(emulateBehavior(createBehavior));
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("counts, conditionally renders, and navigates without losing the current counter", async () => {
  render(<App />);
  const button = await screen.findByRole("button", { name: "Do click" });
  for (let count = 0; count < 6; count++) fireEvent.click(button);
  expect(await screen.findByText("Clicks: 6")).toBeInTheDocument();
  expect(screen.getByText("More than five clicks!")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Go to test page" }));
  expect(await screen.findByText("Test path reached")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/test");
  fireEvent.click(screen.getByRole("button", { name: "Back to counter" }));
  expect(await screen.findByText("Clicks: 6")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/");
});

it("reloads at the current route on browser navigation", async () => {
  render(<App />);
  await screen.findByText("Clicks: 0");
  const oldSignal = vi.mocked(loadWasmClient).mock.calls[0]![1];
  window.history.replaceState(null, "", "/test");
  fireEvent(window, new PopStateEvent("popstate"));
  expect(await screen.findByText("Test path reached")).toBeInTheDocument();
  await waitFor(() => expect(loadWasmClient).toHaveBeenCalledTimes(2));
  expect(oldSignal.aborted).toBe(true);
});

it("does not expose arbitrary navigation targets", () => {
  const tools = createNavigationTools(window);
  expect(() =>
    tools.navigate!(
      { path: "https://example.com/" },
      { signal: new AbortController().signal },
    ),
  ).toThrow("demo routes");
  expect(window.location.pathname).toBe("/");
});
