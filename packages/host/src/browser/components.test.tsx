import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createLibrary, Renderer } from "@openuidev/react-lang";
import { afterEach, expect, it, vi } from "vitest";
import {
  browserComponents,
  Canvas,
  Video,
  Keyboard,
  Pointer,
  Viewport,
  Overlay,
} from "./components";
import { PointerContext } from "./pointer";
import { KeyboardContext } from "./keyboard";
import { BrowserSurfacesContext } from "./surfaces";
import { createBrowserInterop } from "./index";

afterEach(cleanup);
const library = createLibrary({ components: browserComponents });
const document =
  'root = Keyboard("game", ["Space"], [Canvas("scene", 320, 180, "Game scene"), Video("clip", "Clip")], "Game controls")';

it("exports one shared catalog and documents functional props without arbitrary styling", () => {
  expect(browserComponents).toEqual([
    Canvas,
    Video,
    Keyboard,
    Pointer,
    Viewport,
    Overlay,
  ]);
  const schema = library.toJSONSchema();
  expect(Object.keys(schema.properties ?? {})).toEqual([
    "Canvas",
    "Video",
    "Keyboard",
    "Pointer",
    "Viewport",
    "Overlay",
  ]);
  expect(schema.$defs?.Canvas?.properties?.width).toMatchObject({
    type: "integer",
    exclusiveMinimum: 0,
  });
  for (const name of [
    "Canvas",
    "Video",
    "Keyboard",
    "Pointer",
    "Viewport",
    "Overlay",
  ]) {
    const props = schema.$defs?.[name]?.properties;
    for (const blocked of [
      "className",
      "style",
      "color",
      "font",
      "src",
      "onKeyDown",
      "onPointerMove",
    ])
      expect(props).not.toHaveProperty(blocked);
    expect(library.prompt()).toContain(name);
  }
});

it("composes accessible in-viewport controls without replacing or covering the surface with an input layer", () => {
  const source =
    'root = Viewport(Canvas("world", 960, 640), [Overlay("top", [Video("hud")], false), Overlay("center", [Keyboard("menu", ["Enter"], [Video("menu")])])])';
  const view = render(
    <Renderer.Root library={library} response={source}>
      <Renderer.Content />
    </Renderer.Root>,
  );
  const viewport = view.container.querySelector("[data-druid-viewport]")!;
  expect(viewport).toHaveStyle({ position: "relative", overflow: "hidden" });
  const top = viewport.querySelector('[data-druid-overlay="top"]')!;
  expect(top).toHaveStyle({ pointerEvents: "none" });
  expect(top.firstElementChild).toHaveStyle({ pointerEvents: "none" });
  const center = viewport.querySelector('[data-druid-overlay="center"]')!;
  expect(center.firstElementChild).toHaveStyle({
    pointerEvents: "auto",
    overflow: "auto",
    maxHeight: "100%",
  });
  expect(screen.getAllByText("Video unavailable in this preview")).toHaveLength(
    2,
  );
});

it("registers typed pointer listeners through a real OpenUI document", () => {
  vi.stubGlobal("PointerEvent", class extends MouseEvent {});
  const dispatch = vi.fn();
  const source =
    'root = Pointer("art", ["click"], [Canvas("art", 200, 100)], "Art input")';
  const view = render(
    <PointerContext.Provider value={dispatch}>
      <Renderer.Root library={library} response={source}>
        <Renderer.Content />
      </Renderer.Root>
    </PointerContext.Provider>,
  );
  fireEvent.click(screen.getByText("Canvas unavailable in this preview"), {
    clientX: 25,
    clientY: 30,
  });
  expect(dispatch).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ region: "art", kind: "click", x: 25, y: 30 }),
  );
  view.unmount();
  vi.unstubAllGlobals();
});

it("renders real documents inertly without WASM or browser network requests", () => {
  render(
    <Renderer.Root library={library} response={document}>
      <Renderer.Content />
    </Renderer.Root>,
  );
  expect(
    screen.getByText("Canvas unavailable in this preview"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Video unavailable in this preview"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("group", { name: "Game controls" }),
  ).not.toHaveAttribute("tabindex");
  expect(globalThis.document.querySelector("video")).toBeNull();
});

it("mounts shared surfaces and delivers typed keyboard events in a running host", () => {
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal),
    dispatch = vi.fn();
  render(
    <BrowserSurfacesContext.Provider value={browser.surfaces}>
      <KeyboardContext.Provider value={dispatch}>
        <Renderer.Root library={library} response={document}>
          <Renderer.Content />
        </Renderer.Root>
      </KeyboardContext.Provider>
    </BrowserSurfacesContext.Provider>,
  );
  const canvas = screen.getByLabelText("Game scene", { selector: "canvas" });
  expect(canvas).toHaveAttribute("width", "320");
  expect(canvas).toHaveAttribute("height", "180");
  expect(
    screen.getByLabelText("Clip", { selector: "video" }),
  ).not.toHaveAttribute("src");
  const region = screen.getByRole("group", { name: "Game controls" });
  region.focus();
  fireEvent.keyDown(region, { code: "Space", key: " " });
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "down", region: "game", code: "Space" }),
  );
  controller.abort();
});
