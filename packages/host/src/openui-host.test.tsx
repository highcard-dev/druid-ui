import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { openuiLibrary } from "@openuidev/react-ui";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OpenUIHost } from "./openui-host";
import { loadWasmClient } from "./wasm";

vi.mock("./wasm", () => ({ loadWasmClient: vi.fn() }));

beforeEach(() => {
  vi.mocked(loadWasmClient)
    .mockReset()
    .mockResolvedValue({ dispatch: vi.fn() });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          `root = TextContent("${
            url === "/first.openui" ? "First" : "Updated"
          } document")`,
        ),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("fetches private documents through the caller and refetches on reloadKey", async () => {
  const fetchResource = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response('root = TextContent("Private document")'),
  );
  const props = {
    library: openuiLibrary,
    openUiSourceUrl: "/private.openui",
    fetchResource,
  };
  const { rerender } = render(<OpenUIHost {...props} reloadKey={1} />);
  expect(await screen.findByText("Private document")).toBeInTheDocument();
  const signal = fetchResource.mock.calls[0]![1]?.signal;
  expect(fetchResource).toHaveBeenCalledWith("/private.openui", {
    signal: expect.any(AbortSignal),
  });
  expect(fetch).not.toHaveBeenCalled();
  rerender(<OpenUIHost {...props} reloadKey={2} />);
  await waitFor(() => expect(fetchResource).toHaveBeenCalledTimes(2));
  expect(signal?.aborted).toBe(true);
  expect(await screen.findByText("Private document")).toBeInTheDocument();
});

it("renders an independent document and accepts an updated source", async () => {
  const { rerender } = render(
    <OpenUIHost
      library={openuiLibrary}
      openUiSourceUrl="/first.openui"
      wasmUrl="/first.wasm"
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(await screen.findByText("First document")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/first.openui", {
    signal: expect.any(AbortSignal),
  });
  expect(loadWasmClient).toHaveBeenCalledWith(
    "/first.wasm",
    expect.any(AbortSignal),
    { getValue: expect.any(Function), setValue: expect.any(Function) },
    expect.any(Object),
  );
  const firstSignal = vi.mocked(loadWasmClient).mock.calls.at(-1)![1];

  rerender(
    <OpenUIHost
      library={openuiLibrary}
      openUiSourceUrl="/updated.openui"
      wasmUrl="/updated.wasm"
    />,
  );
  expect(await screen.findByText("Updated document")).toBeInTheDocument();
  expect(screen.queryByText("First document")).not.toBeInTheDocument();
  expect(firstSignal.aborted).toBe(true);
});

it("initializes exactly one new guest when reloading an unchanged document URL", async () => {
  const props = {
    library: openuiLibrary,
    openUiSourceUrl: "/first.openui",
    wasmUrl: "/client.wasm",
  };
  const { rerender } = render(<OpenUIHost {...props} reloadKey={1} />);
  await screen.findByText("First document");
  const oldSignal = vi.mocked(loadWasmClient).mock.calls[0]![1];
  rerender(<OpenUIHost {...props} reloadKey={2} />);
  await screen.findByText("First document");
  expect(loadWasmClient).toHaveBeenCalledTimes(2);
  expect(oldSignal.aborted).toBe(true);
});

it("shows HTTP errors instead of rendering an error page as OpenUI", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response("Not found", { status: 404 }),
  );
  render(
    <OpenUIHost
      library={openuiLibrary}
      openUiSourceUrl="/missing"
      wasmUrl="/client.wasm"
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "OpenUI document request failed (404)",
  );
  expect(loadWasmClient).not.toHaveBeenCalled();
});

it("surfaces WASM loading failures", async () => {
  vi.mocked(loadWasmClient).mockRejectedValueOnce(new Error("Invalid WASM"));
  render(
    <OpenUIHost
      library={openuiLibrary}
      openUiSourceUrl="/first.openui"
      wasmUrl="/bad.wasm"
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid WASM");
});

it("ignores late responses after URLs change and aborts on unmount", async () => {
  let resolveFirst!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
  );
  const { rerender, unmount } = render(
    <OpenUIHost
      library={openuiLibrary}
      openUiSourceUrl="/first.openui"
      wasmUrl="/first.wasm"
    />,
  );
  rerender(
    <OpenUIHost
      library={openuiLibrary}
      openUiSourceUrl="/updated.openui"
      wasmUrl="/updated.wasm"
    />,
  );
  expect(await screen.findByText("Updated document")).toBeInTheDocument();
  await act(async () => {
    resolveFirst(new Response('root = TextContent("Stale document")'));
  });
  await waitFor(() =>
    expect(screen.queryByText("Stale document")).not.toBeInTheDocument(),
  );
  const currentSignal = vi.mocked(loadWasmClient).mock.calls.at(-1)![1];
  unmount();
  expect(currentSignal.aborted).toBe(true);
});

it("cancels a pending WASM load and blocks its state writes after a URL change", async () => {
  let resolveFirst!: (
    client: Awaited<ReturnType<typeof loadWasmClient>>,
  ) => void;
  vi.mocked(loadWasmClient).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
  );
  const { rerender } = render(
    <OpenUIHost
      library={openuiLibrary}
      openUiSourceUrl="/first.openui"
      wasmUrl="/first.wasm"
    />,
  );
  await waitFor(() => expect(loadWasmClient).toHaveBeenCalledTimes(1));
  expect(screen.queryByText("First document")).not.toBeInTheDocument();
  const [, signal, state] = vi.mocked(loadWasmClient).mock.calls[0]!;
  rerender(
    <OpenUIHost
      library={openuiLibrary}
      openUiSourceUrl="/updated.openui"
      wasmUrl="/updated.wasm"
    />,
  );
  expect(await screen.findByText("Updated document")).toBeInTheDocument();
  expect(signal.aborted).toBe(true);
  expect(() => state.setValue("$previewText", '"stale"')).toThrow();
  await act(async () => {
    resolveFirst({ dispatch: vi.fn() });
  });
  expect(screen.getByText("Updated document")).toBeInTheDocument();
  expect(screen.queryByText("First document")).not.toBeInTheDocument();
});
