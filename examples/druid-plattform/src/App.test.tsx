import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import source from "./view.openui?raw";
import { createBehavior } from "./client/behavior";
import { createMemoryTools } from "./tools";
import { loadWasmClient } from "../../../packages/host/src/wasm";
import { emulateBehavior } from "../../../tests/example-runtime";
vi.mock("../../../packages/host/src/wasm", () => ({ loadWasmClient: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/data/status.json")
        ? Response.json({ status: "ready" })
        : new Response(source),
    ),
  );
  vi.mocked(loadWasmClient).mockImplementation(emulateBehavior(createBehavior));
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("loads, edits, saves and rereads arbitrary configuration text and fetches status", async () => {
  render(<App />);
  const editor = await screen.findByRole("textbox", {
    name: "server.properties",
  });
  expect((editor as HTMLTextAreaElement).value).toContain("max-players=20");
  const content =
    "# Preserve comments and unknown properties\nmotd=Updated\ncustom=value=with=equals\n";
  fireEvent.change(editor, { target: { value: content } });
  fireEvent.click(screen.getByRole("button", { name: "Write file" }));
  expect(await screen.findByText("Saved in memory")).toBeInTheDocument();
  fireEvent.change(editor, { target: { value: "Unsaved edits" } });
  fireEvent.click(screen.getByRole("button", { name: "Read file" }));
  expect(await screen.findByText("Configuration loaded")).toBeInTheDocument();
  expect(editor).toHaveValue(content);
  fireEvent.click(screen.getByRole("button", { name: "Fetch status" }));
  expect(await screen.findByText("Request complete")).toBeInTheDocument();
  expect(screen.getByText(/ready/)).toBeInTheDocument();
});

it("keeps files instance-local, rejects other paths and refuses aborted work", async () => {
  const first = createMemoryTools(fetch, "https://demo.example/");
  const second = createMemoryTools(fetch, "https://demo.example/");
  const controller = new AbortController();
  const context = { signal: controller.signal };
  await first.file_write!(
    { path: "server.properties", content: "first" },
    context,
  );
  expect(await first.file_read!({ path: "server.properties" }, context)).toBe(
    "first",
  );
  expect(
    await second.file_read!({ path: "server.properties" }, context),
  ).not.toBe("first");
  expect(() => first.file_read!({ path: "../secret" }, context)).toThrow(
    "exposed by this host",
  );
  controller.abort();
  expect(() =>
    first.file_write!({ path: "server.properties", content: "stale" }, context),
  ).toThrow();
});
