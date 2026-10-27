import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Renderer, defineAction } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui";
import { z } from "zod";
import { afterEach, expect, it, vi } from "vitest";
import { WasmRoot } from "./wasm-root";
import { loadWasmClient } from "./wasm";

vi.mock("./wasm", () => ({ loadWasmClient: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const library = openuiLibrary.extend({
  actions: {
    add: [
      defineAction({
        name: "UpdateStatus",
        description: "Update status in WASM",
        params: z.object({}),
      }),
    ],
  },
});
const source =
  '$status = "Waiting"\nroot = Stack([TextContent($status), Button("Update", @UpdateStatus())])';

it("owns loading, action dispatch and reactive state without an external client ref", async () => {
  const dispatch = vi.fn();
  vi.mocked(loadWasmClient).mockImplementation(
    async (_url, _signal, state) => ({
      dispatch(action, params) {
        dispatch(action, params);
        state.setValue("$status", JSON.stringify("Updated by WASM"));
      },
    }),
  );
  const onAction = vi.fn();
  const { rerender, unmount } = render(
    <WasmRoot
      wasmUrl="/first.wasm"
      response={source}
      library={library}
      onAction={onAction}
    >
      <Renderer.Content />
    </WasmRoot>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(await screen.findByText("Waiting")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Update" }));
  expect(await screen.findByText("Updated by WASM")).toBeInTheDocument();
  expect(dispatch).toHaveBeenCalledWith("UpdateStatus", {});
  expect(onAction).toHaveBeenCalledWith(
    expect.objectContaining({ type: "UpdateStatus" }),
  );
  const [, oldSignal, oldState] = vi.mocked(loadWasmClient).mock.calls[0]!;
  expect(oldState.getValue("$status")).toBe(JSON.stringify("Updated by WASM"));

  rerender(
    <WasmRoot
      wasmUrl="/second.wasm"
      response={source}
      library={library}
      onAction={onAction}
    >
      <Renderer.Content />
    </WasmRoot>,
  );
  expect(await screen.findByText("Waiting")).toBeInTheDocument();
  expect(oldSignal.aborted).toBe(true);
  expect(() => oldState.setValue("$status", '"Stale"')).toThrow();
  expect(() => oldState.getValue("$status")).toThrow();
  expect(loadWasmClient).toHaveBeenCalledTimes(2);
  const currentSignal = vi.mocked(loadWasmClient).mock.calls[1]![1];
  unmount();
  expect(currentSignal.aborted).toBe(true);
});

it("renders caller-provided children without inserting OpenUI content or reloading WASM", async () => {
  vi.mocked(loadWasmClient).mockResolvedValue({ dispatch: vi.fn() });
  const { rerender } = render(
    <WasmRoot wasmUrl="/client.wasm" response={source} library={library}>
      <p>Custom content</p>
    </WasmRoot>,
  );
  expect(screen.queryByText("Custom content")).not.toBeInTheDocument();
  expect(await screen.findByText("Custom content")).toBeInTheDocument();
  expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
  rerender(
    <WasmRoot wasmUrl="/client.wasm" response={source} library={library}>
      <p>Updated content</p>
    </WasmRoot>,
  );
  expect(screen.getByText("Updated content")).toBeInTheDocument();
  expect(screen.queryByText("Custom content")).not.toBeInTheDocument();
  expect(loadWasmClient).toHaveBeenCalledTimes(1);
});

it("round-trips JSON state and distinguishes missing values from null", async () => {
  const onStateUpdate = vi.fn();
  vi.mocked(loadWasmClient).mockResolvedValue({ dispatch: vi.fn() });
  render(
    <WasmRoot
      wasmUrl="/client.wasm"
      response={source}
      library={library}
      onStateUpdate={onStateUpdate}
    >
      <Renderer.Content />
    </WasmRoot>,
  );
  await screen.findByText("Waiting");
  const state = vi.mocked(loadWasmClient).mock.calls[0]![2];
  expect(state.getValue("$status")).toBe('"Waiting"');
  expect(state.getValue("$missing")).toBeUndefined();
  await act(async () => {
    state.setValue("$status", '"Changed"');
    state.setValue("$nullable", "null");
    state.setValue("$data", '{"value":42,"enabled":true}');
  });
  expect(await screen.findByText("Changed")).toBeInTheDocument();
  expect(state.getValue("$nullable")).toBe("null");
  expect(JSON.parse(state.getValue("$data")!)).toEqual({
    value: 42,
    enabled: true,
  });
  expect(() => state.setValue("$status", "invalid JSON")).toThrow();
  expect(state.getValue("$status")).toBe('"Changed"');
  expect(onStateUpdate).toHaveBeenCalled();
  expect(loadWasmClient).toHaveBeenCalledTimes(1);
});

it("reloads an unchanged URL only when reloadKey changes and aborts the previous instance", async () => {
  vi.mocked(loadWasmClient).mockResolvedValue({ dispatch: vi.fn() });
  const props = { wasmUrl: "/client.wasm", response: source, library };
  const { rerender } = render(
    <WasmRoot {...props} reloadKey={1}>
      <Renderer.Content />
    </WasmRoot>,
  );
  await screen.findByText("Waiting");
  const signal = vi.mocked(loadWasmClient).mock.calls[0]![1];
  rerender(
    <WasmRoot {...props} reloadKey={1} toolProvider={{ changed: () => null }}>
      <Renderer.Content />
    </WasmRoot>,
  );
  expect(loadWasmClient).toHaveBeenCalledTimes(1);
  rerender(
    <WasmRoot {...props} reloadKey={2}>
      <Renderer.Content />
    </WasmRoot>,
  );
  await screen.findByText("Waiting");
  expect(loadWasmClient).toHaveBeenCalledTimes(2);
  expect(signal.aborted).toBe(true);
});

it("supports documents and caller-owned children without WASM", async () => {
  render(
    <WasmRoot response={source} library={library}>
      <p>Document only</p>
    </WasmRoot>,
  );
  expect(await screen.findByText("Document only")).toBeInTheDocument();
  expect(loadWasmClient).not.toHaveBeenCalled();
});
