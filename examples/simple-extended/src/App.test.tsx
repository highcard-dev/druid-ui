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
import { createHttpTools } from "./tools";
import { loadWasmClient } from "../../../packages/host/src/wasm";
import { emulateBehavior } from "../../../tests/example-runtime";
vi.mock("../../../packages/host/src/wasm", () => ({ loadWasmClient: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/data/message.json"))
        return Response.json({ message: "Fetched through the host" });
      if (url.endsWith("/data/missing.json"))
        return new Response("Not found", { status: 404 });
      return new Response(source);
    }),
  );
  vi.mocked(loadWasmClient).mockImplementation(emulateBehavior(createBehavior));
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("passes edited resources through the guest and displays success, error and recovery", async () => {
  render(<App />);
  const resource = await screen.findByRole("textbox", { name: "Resource" });
  fireEvent.click(screen.getByRole("button", { name: "Fetch JSON" }));
  expect(await screen.findByText("Request complete")).toBeInTheDocument();
  expect(screen.getByText(/Fetched through the host/)).toBeInTheDocument();
  fireEvent.change(resource, { target: { value: "missing.json" } });
  fireEvent.click(screen.getByRole("button", { name: "Fetch JSON" }));
  expect(
    await screen.findByText("HTTP request failed (404)"),
  ).toBeInTheDocument();
  fireEvent.change(resource, { target: { value: "message.json" } });
  fireEvent.click(screen.getByRole("button", { name: "Fetch JSON" }));
  expect(await screen.findByText("Request complete")).toBeInTheDocument();
  await waitFor(() => expect(loadWasmClient).toHaveBeenCalledTimes(1));
});

it("rejects unregistered URLs before fetch and forwards cancellation to allowed fetches", async () => {
  const fetchResource = vi.fn(async () => Response.json({ ok: true }));
  const tools = createHttpTools(fetchResource, "https://demo.example/");
  const signal = new AbortController().signal;
  await expect(
    tools.http_get!({ path: "https://other.example/" }, { signal }),
  ).rejects.toThrow("exposed by this host");
  expect(fetchResource).not.toHaveBeenCalled();
  await tools.http_get!({ path: "message.json" }, { signal });
  expect(fetchResource).toHaveBeenCalledWith(
    new URL("https://demo.example/data/message.json"),
    { signal, headers: { Accept: "application/json" } },
  );
});
