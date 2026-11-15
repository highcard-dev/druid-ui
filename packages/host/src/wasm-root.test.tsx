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
import { BrowserKeyboard } from "./browser/keyboard";
import { BrowserPointer } from "./browser/pointer";

vi.mock("./wasm", () => ({ loadWasmClient: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
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

it("uses the application modal for typed requests during guest initialization", async () => {
  const confirm = vi.fn().mockResolvedValue(undefined);
  const native = vi.fn();
  vi.stubGlobal("confirm", native);
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(new Uint8Array([0, 255])));
  vi.stubGlobal("fetch", fetcher);
  vi.mocked(loadWasmClient).mockImplementation(
    async (_url, _signal, state, options) => {
      const response = await options!.browserInterop!.imports[
        "druid:openui/http"
      ].request({
        url: "https://assets.test/archive.tar",
        method: "GET",
        headers: [],
      });
      expect(response.body).toEqual(new Uint8Array([0, 255]));
      state.setValue(
        "$status",
        JSON.stringify("Downloaded through typed HTTP"),
      );
      return { dispatch: vi.fn() };
    },
  );
  render(
    <WasmRoot
      wasmUrl="/http.wasm"
      response={source}
      library={library}
      confirmHttpRequest={confirm}
    >
      <Renderer.Content />
    </WasmRoot>,
  );
  await screen.findByText("Downloaded through typed HTTP");
  expect(confirm).toHaveBeenCalledWith("https://assets.test/archive.tar");
  expect(native).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("connects keyboard regions to the current guest and removes them on unmount", async () => {
  const dispatchKey = vi.fn();
  vi.mocked(loadWasmClient).mockResolvedValue({
    dispatch: vi.fn(),
    dispatchKey,
  });
  const { unmount } = render(
    <WasmRoot wasmUrl="/keys.wasm" response={source} library={library}>
      <BrowserKeyboard id="keys" codes={["Space"]}>
        Keyboard scene
      </BrowserKeyboard>
      <Renderer.Content />
    </WasmRoot>,
  );
  const region = await screen.findByRole("group");
  region.focus();
  fireEvent.keyDown(region, { key: " ", code: "Space" });
  expect(dispatchKey).toHaveBeenCalledWith(
    expect.objectContaining({ region: "keys", kind: "down", code: "Space" }),
  );
  unmount();
  expect(vi.mocked(loadWasmClient).mock.calls[0]![1].aborted).toBe(true);
  dispatchKey.mockClear();
  fireEvent(window, new Event("blur"));
  fireEvent.keyDown(region, { code: "Space" });
  expect(dispatchKey).not.toHaveBeenCalled();
});

it("connects pointer regions to the current guest and leaves non-pointer guests inert", async () => {
  vi.stubGlobal("PointerEvent", class extends MouseEvent {});
  const dispatchPointer = vi.fn();
  vi.mocked(loadWasmClient).mockResolvedValue({
    dispatch: vi.fn(),
    dispatchPointer,
  });
  const { rerender, unmount } = render(
    <WasmRoot wasmUrl="/pointer.wasm" response={source} library={library}>
      <BrowserPointer id="art" events={["click"]}>
        Art
      </BrowserPointer>
    </WasmRoot>,
  );
  const region = await screen.findByRole("group");
  fireEvent.click(region, { clientX: 40, clientY: 60 });
  expect(dispatchPointer).toHaveBeenCalledWith(
    expect.objectContaining({ region: "art", kind: "click", x: 40, y: 60 }),
  );
  vi.mocked(loadWasmClient).mockResolvedValue({ dispatch: vi.fn() });
  rerender(
    <WasmRoot wasmUrl="/plain.wasm" response={source} library={library}>
      <BrowserPointer id="art" events={["click"]}>
        Art
      </BrowserPointer>
    </WasmRoot>,
  );
  const inert = await screen.findByRole("group");
  expect(inert).not.toHaveAttribute("tabindex");
  dispatchPointer.mockClear();
  fireEvent.click(inert);
  expect(dispatchPointer).not.toHaveBeenCalled();
  unmount();
  fireEvent.click(inert);
  expect(dispatchPointer).not.toHaveBeenCalled();
});

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
