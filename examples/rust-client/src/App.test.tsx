import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import source from "./view.openui?raw";
import { loadWasmClient } from "../../../packages/host/src/wasm";

vi.mock("../../../packages/host/src/wasm", () => ({ loadWasmClient: vi.fn() }));
const dispatch = vi.fn();
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(source)),
  );
  vi.mocked(loadWasmClient).mockResolvedValue({ dispatch });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

// The Rust binary is covered separately by test:rust. These checks deliberately
// need no Cargo build, so the regular SDK test suite stays JavaScript-only.
it("renders the document and sends named actions with distinct result targets", async () => {
  render(<App />);
  const name = await screen.findByRole("textbox", { name: "Name" });
  fireEvent.change(name, { target: { value: "Ada" } });
  fireEvent.click(screen.getByRole("button", { name: "Increment in Rust" }));
  expect(dispatch).toHaveBeenLastCalledWith("Increment", {});
  fireEvent.click(screen.getByRole("button", { name: "First greeting" }));
  expect(dispatch).toHaveBeenLastCalledWith("Greet", {
    name: "Ada",
    target: "$first",
  });
  fireEvent.click(screen.getByRole("button", { name: "Second greeting" }));
  expect(dispatch).toHaveBeenLastCalledWith("Greet", {
    name: "Ada",
    target: "$second",
  });
  expect(loadWasmClient).toHaveBeenCalledTimes(1);
});

it("registers the async tool, propagates its errors, and cancels it on unmount", async () => {
  const { unmount } = render(<App />);
  await screen.findByRole("button", { name: "First greeting" });
  const session = vi.mocked(loadWasmClient).mock.calls[0]![3]!.session!;
  await expect(session.run("greet", { name: "Ada" })).resolves.toEqual({
    message: "Hello, Ada, from a Rust client!",
  });
  await expect(session.run("greet", { name: "fail" })).rejects.toThrow(
    "Greeting rejected by the host",
  );
  unmount();
  await expect(session.run("greet", { name: "stale" })).rejects.toMatchObject({
    name: "AbortError",
  });
});
