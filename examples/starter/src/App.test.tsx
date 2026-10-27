import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import document from "./settings.openui?raw";
import { loadWasmClient } from "../../../packages/host/src/wasm";

vi.mock("../../../packages/host/src/wasm", () => ({
  loadWasmClient: vi.fn(),
}));
const dispatch = vi.fn();

beforeEach(() => {
  dispatch.mockClear();
  vi.mocked(loadWasmClient).mockReset().mockResolvedValue({ dispatch });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(document)),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OpenUI demo", () => {
  it("renders the authored document without saving on mount", async () => {
    render(<App />);
    expect(
      await screen.findByRole("textbox", { name: /Server name/ }),
    ).toHaveValue("My Minecraft server");
    expect(
      screen.getByRole("spinbutton", { name: "Player limit" }),
    ).toHaveValue(20);
    expect(screen.getByLabelText("Saved settings")).toHaveTextContent(
      "No settings saved yet.",
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("passes edited values through the real OpenUI mutation to the React host", async () => {
    render(<App />);
    fireEvent.change(
      await screen.findByRole("textbox", { name: /Server name/ }),
      { target: { value: "Friends server" } },
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Player limit" }), {
      target: { value: "32" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Saved locally")).toBeInTheDocument();
    expect(
      JSON.parse(screen.getByLabelText("Saved settings").textContent!),
    ).toEqual({
      serverName: "Friends server",
      players: 32,
      difficulty: "normal",
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset form" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: /Server name/ })).toHaveValue(
        "My Minecraft server",
      ),
    );
    expect(
      screen.getByRole("spinbutton", { name: "Player limit" }),
    ).toHaveValue(20);
  });

  it("dispatches the custom action with current values without saving", async () => {
    render(<App />);
    expect(screen.getByLabelText("Preview settings")).toHaveTextContent(
      "No preview requested yet.",
    );
    fireEvent.change(
      await screen.findByRole("textbox", { name: /Server name/ }),
      { target: { value: "Preview server" } },
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Player limit" }), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview settings" }));

    await waitFor(() =>
      expect(
        JSON.parse(screen.getByLabelText("Preview settings").textContent!),
      ).toEqual({
        serverName: "Preview server",
        players: "12",
        difficulty: "normal",
      }),
    );
    expect(screen.getByLabelText("Saved settings")).toHaveTextContent(
      "No settings saved yet.",
    );

    expect(dispatch).toHaveBeenCalledWith("PreviewSettings", {
      serverName: "Preview server",
      players: "12",
      difficulty: "normal",
    });

    fireEvent.change(screen.getByRole("textbox", { name: /Server name/ }), {
      target: { value: "Updated preview" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview settings" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Preview settings")).toHaveTextContent(
        "Updated preview",
      ),
    );
  });

  it("reports a rejected save without changing saved settings", async () => {
    render(<App />);
    fireEvent.change(
      await screen.findByRole("spinbutton", { name: "Player limit" }),
      { target: { value: "0" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Could not save")).toBeInTheDocument();
    expect(screen.getByLabelText("Saved settings")).toHaveTextContent(
      "No settings saved yet.",
    );
  });

  it("renders state written through the WASM host import and resets it with the form", async () => {
    vi.mocked(loadWasmClient).mockImplementation(
      async (_url, _signal, state) => ({
        dispatch(action, params) {
          if (action !== "PreviewSettings") return;
          const { serverName } = params as { serverName: string };
          state.setValue(
            "$previewText",
            JSON.stringify(`Previewing ${serverName}`),
          );
        },
      }),
    );
    render(<App />);
    const name = await screen.findByRole("textbox", { name: /Server name/ });
    expect(screen.getByText("No WASM preview yet.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "WASM server" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview settings" }));
    expect(
      await screen.findByText("Previewing WASM server"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Saved settings")).toHaveTextContent(
      "No settings saved yet.",
    );
    expect(loadWasmClient).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reset form" }));
    expect(await screen.findByText("No WASM preview yet.")).toBeInTheDocument();
    expect(
      screen.queryByText("Previewing WASM server"),
    ).not.toBeInTheDocument();
  });
});
