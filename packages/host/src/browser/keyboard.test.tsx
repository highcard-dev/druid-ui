import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrowserKeyboard, KeyboardContext } from "./keyboard";
import { BrowserPointer, PointerContext } from "./pointer";

afterEach(cleanup);

it("delivers game keys from the focused nested pointer scope", () => {
  const dispatch = vi.fn();
  render(
    <KeyboardContext.Provider value={dispatch}>
      <PointerContext.Provider value={vi.fn()}>
        <BrowserKeyboard
          id="gunter3"
          codes={["KeyW", "KeyD", "KeyT"]}
          label="Game keys"
        >
          <BrowserPointer
            id="gunter3"
            events={["down", "click"]}
            label="Game pointer"
          >
            <canvas aria-label="Game scene" />
          </BrowserPointer>
        </BrowserKeyboard>
      </PointerContext.Provider>
    </KeyboardContext.Provider>,
  );
  const pointer = screen.getByRole("group", { name: "Game pointer" });
  pointer.focus();
  expect(document.activeElement).toBe(pointer);
  for (const code of ["KeyW", "KeyD", "KeyT"]) {
    fireEvent.keyDown(document.activeElement!, {
      code,
      key: code.slice(-1).toLowerCase(),
    });
    fireEvent.keyUp(document.activeElement!, {
      code,
      key: code.slice(-1).toLowerCase(),
    });
  }
  expect(
    dispatch.mock.calls.map(([event]) => [event.code, event.kind]),
  ).toEqual([
    ["KeyW", "down"],
    ["KeyW", "up"],
    ["KeyD", "down"],
    ["KeyD", "up"],
    ["KeyT", "down"],
    ["KeyT", "up"],
  ]);
});

function setup() {
  const dispatch = vi.fn();
  const view = render(
    <KeyboardContext.Provider value={dispatch}>
      <BrowserKeyboard id="game" codes={["Space", "KeyM"]}>
        <canvas aria-label="scene" />
        <span tabIndex={0}>Focus pad</span>
        <input aria-label="Text" />
        <button>Play</button>
        <a href="#">Link</a>
        <div tabIndex={0} contentEditable suppressContentEditableWarning>
          Editable
        </div>
      </BrowserKeyboard>
      <button>Outside</button>
    </KeyboardContext.Provider>,
  );
  const region = screen.getByRole("group");
  region.focus();
  return { dispatch, region, ...view };
}

it("passes typed down/up events, repeats, physical/logical keys and timing without JSON", () => {
  const { dispatch, region } = setup();
  expect(
    fireEvent.keyDown(region, {
      key: " ",
      code: "Space",
      shiftKey: true,
      repeat: true,
    }),
  ).toBe(false);
  expect(dispatch).toHaveBeenLastCalledWith({
    region: "game",
    kind: "down",
    key: " ",
    code: "Space",
    repeat: true,
    shift: true,
    control: false,
    alt: false,
    meta: false,
    timestamp: expect.any(Number),
  });
  fireEvent.keyUp(region, { key: " ", code: "Space" });
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "up", repeat: false }),
  );
});

it("does not consume unbound keys, composing input or modified browser shortcuts", () => {
  const { dispatch, region } = setup();
  expect(fireEvent.keyDown(region, { code: "Tab" })).toBe(true);
  expect(fireEvent.keyDown(region, { code: "KeyM", isComposing: true })).toBe(
    true,
  );
  expect(dispatch).not.toHaveBeenCalled();
  expect(
    fireEvent.keyDown(region, { key: "m", code: "KeyM", ctrlKey: true }),
  ).toBe(true);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ control: true }),
  );
});

it("leaves typing, links and native controls alone, including clicks and Space", () => {
  const { dispatch, region } = setup();
  for (const element of [
    screen.getByLabelText("Text"),
    screen.getByText("Play"),
    screen.getByText("Link"),
    screen.getByText("Editable"),
  ]) {
    element.focus();
    dispatch.mockClear();
    fireEvent.pointerDown(element);
    expect(document.activeElement).toBe(element);
    expect(fireEvent.keyDown(element, { key: " ", code: "Space" })).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  }
  fireEvent.pointerDown(screen.getByLabelText("scene"));
  expect(document.activeElement).toBe(region);
});

it("reports leaving the region or browser window, not moving within the region", () => {
  const { dispatch, region, unmount } = setup();
  screen.getByText("Focus pad").focus();
  expect(dispatch).not.toHaveBeenCalled();
  screen.getByLabelText("Text").focus();
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "blur" }),
  );
  dispatch.mockClear();
  screen.getByText("Outside").focus();
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({
      region: "game",
      kind: "blur",
      key: "",
      code: "",
    }),
  );
  dispatch.mockClear();
  fireEvent(window, new Event("blur"));
  expect(dispatch).not.toHaveBeenCalled();
  region.focus();
  fireEvent(window, new Event("blur"));
  expect(dispatch).toHaveBeenCalledOnce();
  unmount();
  dispatch.mockClear();
  fireEvent(window, new Event("blur"));
  fireEvent.keyDown(region, { code: "Space" });
  expect(dispatch).not.toHaveBeenCalled();
});

it("does not capture global keystrokes or route a nested region to its parent", () => {
  const outer = vi.fn(),
    inner = vi.fn();
  render(
    <KeyboardContext.Provider value={outer}>
      <BrowserKeyboard id="outer" codes={["Space"]} label="Outer">
        <KeyboardContext.Provider value={inner}>
          <BrowserKeyboard id="inner" codes={["Space"]} label="Inner">
            Scene
          </BrowserKeyboard>
        </KeyboardContext.Provider>
      </BrowserKeyboard>
    </KeyboardContext.Provider>,
  );
  fireEvent.keyDown(document.body, { code: "Space" });
  expect(outer).not.toHaveBeenCalled();
  expect(inner).not.toHaveBeenCalled();
  fireEvent.pointerDown(screen.getByText("Scene"));
  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "Inner" }),
  );
  fireEvent.keyDown(screen.getByText("Scene"), { code: "Space" });
  expect(inner).toHaveBeenCalledOnce();
  expect(outer).not.toHaveBeenCalled();
});

it("is inert without a guest keyboard export, including isolated layout previews", () => {
  render(
    <BrowserKeyboard id="preview" codes={["Space"]}>
      Preview
    </BrowserKeyboard>,
  );
  const region = screen.getByRole("group");
  expect(region).not.toHaveAttribute("tabindex");
  expect(fireEvent.keyDown(region, { code: "Space" })).toBe(true);
});
