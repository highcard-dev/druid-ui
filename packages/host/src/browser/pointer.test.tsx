import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrowserPointer, PointerContext } from "./pointer";
import { BrowserKeyboard, KeyboardContext } from "./keyboard";

let frames: Map<number, FrameRequestCallback>;
beforeEach(() => {
  frames = new Map();
  let next = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++next, callback);
      return next;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id)),
  );
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId: number;
      pointerType: string;
      pressure: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
        this.pressure = init.pressure ?? 0;
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function nextFrame() {
  for (const [id, callback] of [...frames]) {
    frames.delete(id);
    callback(16);
  }
}
function capture(region: HTMLElement) {
  const active = new Set<number>();
  Object.assign(region, {
    setPointerCapture: vi.fn((id: number) => active.add(id)),
    hasPointerCapture: vi.fn((id: number) => active.has(id)),
    releasePointerCapture: vi.fn((id: number) => active.delete(id)),
  });
  return active;
}
function setup(
  events: Parameters<typeof BrowserPointer>[0]["events"] = [
    "down",
    "up",
    "move",
    "wheel",
    "click",
    "double-click",
  ],
  menu = false,
) {
  const dispatch = vi.fn();
  const view = render(
    <PointerContext.Provider value={dispatch}>
      <BrowserPointer id="scene" events={events} preventContextMenu={menu}>
        <canvas aria-label="Art" />
        <input aria-label="Text" />
        <button>Play</button>
        <a href="#">Link</a>
        <div contentEditable suppressContentEditableWarning>
          Editable
        </div>
      </BrowserPointer>
      <button>Outside</button>
    </PointerContext.Provider>,
  );
  const region = screen.getByRole("group"),
    active = capture(region);
  vi.spyOn(region, "getBoundingClientRect").mockReturnValue({
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    width: 320,
    height: 200,
    right: 330,
    bottom: 220,
    toJSON() {},
  });
  return {
    ...view,
    dispatch,
    region,
    active,
    canvas: screen.getByLabelText("Art"),
  };
}
it("delivers typed coordinates, dimensions, buttons, device, pressure and modifiers", () => {
  const { dispatch, region, canvas, active } = setup();
  fireEvent.pointerDown(canvas, {
    pointerId: 7,
    pointerType: "pen",
    pressure: 0.75,
    clientX: 42,
    clientY: 57,
    button: 2,
    buttons: 2,
    shiftKey: true,
  });
  expect(document.activeElement).toBe(region);
  expect(active.has(7)).toBe(true);
  expect(dispatch).toHaveBeenCalledExactlyOnceWith({
    region: "scene",
    kind: "down",
    pointerId: 7,
    device: "pen",
    x: 32,
    y: 37,
    width: 320,
    height: 200,
    movementX: 0,
    movementY: 0,
    wheelX: 0,
    wheelY: 0,
    button: 2,
    buttons: 2,
    pressure: 0.75,
    shift: true,
    control: false,
    alt: false,
    meta: false,
    timestamp: expect.any(Number),
  });
});
it("coalesces moves per pointer/frame and flushes final movement before a captured release", () => {
  const { dispatch, canvas, region, active } = setup();
  fireEvent.pointerDown(canvas, {
    pointerId: 1,
    clientX: 20,
    clientY: 30,
    buttons: 1,
  });
  dispatch.mockClear();
  for (let i = 1; i <= 100; i++)
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: 20 + i,
      clientY: 30 + i,
      buttons: 1,
    });
  expect(dispatch).not.toHaveBeenCalled();
  expect(frames.size).toBe(1);
  nextFrame();
  expect(dispatch).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      kind: "move",
      x: 110,
      y: 110,
      movementX: 100,
      movementY: 100,
    }),
  );
  dispatch.mockClear();
  fireEvent.pointerMove(region, {
    pointerId: 1,
    clientX: 450,
    clientY: 300,
    buttons: 1,
  });
  fireEvent.pointerUp(region, {
    pointerId: 1,
    clientX: 450,
    clientY: 300,
    buttons: 0,
  });
  expect(dispatch.mock.calls.map(([e]) => e.kind)).toEqual(["move", "up"]);
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ x: 440, y: 280, buttons: 0 }),
  );
  expect(active.size).toBe(0);
  expect(frames.size).toBe(0);
  fireEvent.lostPointerCapture(region, { pointerId: 1 });
  expect(dispatch).toHaveBeenCalledTimes(2);
});
it("keeps distinct touch pointers in the same coalesced frame", () => {
  const { dispatch, canvas } = setup(["move"]);
  fireEvent.pointerMove(canvas, {
    pointerId: 1,
    pointerType: "touch",
    clientX: 30,
  });
  fireEvent.pointerMove(canvas, {
    pointerId: 2,
    pointerType: "touch",
    clientX: 70,
  });
  nextFrame();
  expect(
    dispatch.mock.calls.map(([e]) => [e.pointerId, e.x, e.device]),
  ).toEqual([
    [1, 20, "touch"],
    [2, 60, "touch"],
  ]);
});
it("normalizes wheel units and preserves modified browser zoom and unbound scrolling", () => {
  const { dispatch, canvas, rerender } = setup(["wheel"]);
  expect(fireEvent.wheel(canvas, { deltaX: 2, deltaY: 3, deltaMode: 1 })).toBe(
    false,
  );
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "wheel", button: -1, wheelX: 32, wheelY: 48 }),
  );
  fireEvent.wheel(canvas, { deltaX: 1, deltaY: 1, deltaMode: 2 });
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ wheelX: 320, wheelY: 200 }),
  );
  expect(fireEvent.wheel(canvas, { deltaY: 9, ctrlKey: true })).toBe(true);
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ wheelY: 9, control: true }),
  );
  rerender(
    <PointerContext.Provider value={dispatch}>
      <BrowserPointer id="scene" events={[]}>
        <canvas aria-label="Art" />
      </BrowserPointer>
    </PointerContext.Provider>,
  );
  dispatch.mockClear();
  expect(fireEvent.wheel(screen.getByLabelText("Art"), { deltaY: 9 })).toBe(
    true,
  );
  expect(dispatch).not.toHaveBeenCalled();
});
it("does not consume native controls, typing, unrequested events or outside-page input", () => {
  const { dispatch, canvas } = setup(["down"]);
  for (const el of [
    screen.getByLabelText("Text"),
    screen.getByText("Play"),
    screen.getByText("Link"),
    screen.getByText("Editable"),
  ]) {
    expect(fireEvent.pointerDown(el, { buttons: 1 })).toBe(true);
    fireEvent.click(el);
    fireEvent.wheel(el, { deltaY: 1 });
  }
  fireEvent.pointerDown(document.body, { buttons: 1 });
  fireEvent.pointerMove(canvas);
  fireEvent.click(canvas);
  expect(dispatch).not.toHaveBeenCalled();
  expect(fireEvent.contextMenu(canvas)).toBe(true);
});
it("reports clicks and optional context-menu suppression only within the active region", () => {
  const { dispatch, canvas } = setup(undefined, true);
  fireEvent.click(canvas, { clientX: 40, clientY: 50 });
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "click", x: 30, y: 30 }),
  );
  fireEvent.doubleClick(canvas);
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "double-click" }),
  );
  expect(fireEvent.contextMenu(canvas)).toBe(false);
  expect(fireEvent.contextMenu(screen.getByLabelText("Text"))).toBe(true);
});
it("releases held state on cancel, capture loss, omitted up and focus/window loss", () => {
  const { dispatch, canvas, region, active } = setup(["down"]);
  fireEvent.pointerDown(canvas, { pointerId: 3, buttons: 1 });
  fireEvent.pointerUp(region, { pointerId: 3 });
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "cancel", buttons: 0 }),
  );
  expect(active.size).toBe(0);
  fireEvent.pointerDown(canvas, { pointerId: 4, buttons: 1 });
  active.delete(4);
  fireEvent.lostPointerCapture(region, { pointerId: 4 });
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "cancel", buttons: 0 }),
  );
  fireEvent.pointerDown(canvas, { pointerId: 5, buttons: 1 });
  fireEvent.pointerCancel(region, { pointerId: 5, buttons: 1 });
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "cancel", buttons: 0, pressure: 0 }),
  );
  fireEvent.pointerDown(canvas, { pointerId: 6, buttons: 1 });
  fireEvent(window, new Event("blur"));
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "blur", buttons: 0 }),
  );
  expect(active.size).toBe(0);
  fireEvent.pointerDown(canvas, { buttons: 1 });
  screen.getByLabelText("Text").focus();
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "blur", buttons: 0 }),
  );
});
it("isolates nested regions and composes with a keyboard scope", () => {
  const dispatch = vi.fn(),
    key = vi.fn();
  render(
    <KeyboardContext.Provider value={key}>
      <BrowserKeyboard id="keys" codes={["Space"]}>
        <PointerContext.Provider value={dispatch}>
          <BrowserPointer id="outer" events={["down", "move"]}>
            <BrowserPointer id="inner" events={["down", "move"]} label="Inner">
              <canvas aria-label="Inner art" />
            </BrowserPointer>
          </BrowserPointer>
        </PointerContext.Provider>
      </BrowserKeyboard>
    </KeyboardContext.Provider>,
  );
  const inner = screen.getByRole("group", { name: "Inner" });
  capture(inner);
  fireEvent.pointerDown(screen.getByLabelText("Inner art"), { buttons: 1 });
  expect(dispatch).toHaveBeenCalledOnce();
  expect(dispatch).toHaveBeenLastCalledWith(
    expect.objectContaining({ region: "inner" }),
  );
  fireEvent.keyDown(inner, { code: "Space" });
  expect(key).toHaveBeenCalledWith(
    expect.objectContaining({ region: "keys", code: "Space" }),
  );
});
it("cancels pending frames/listeners on unmount and is inert without a guest export", () => {
  const { dispatch, canvas, region, unmount } = setup();
  fireEvent.pointerMove(canvas, { clientX: 30 });
  expect(frames.size).toBe(1);
  unmount();
  nextFrame();
  fireEvent.pointerDown(region);
  fireEvent(window, new Event("blur"));
  expect(dispatch).not.toHaveBeenCalled();
  render(
    <BrowserPointer id="preview" events={["down", "wheel"]} preventContextMenu>
      Preview
    </BrowserPointer>,
  );
  const preview = screen.getByRole("group");
  expect(preview).not.toHaveAttribute("tabindex");
  expect(preview.style.touchAction).toBeUndefined();
  expect(fireEvent.pointerDown(preview)).toBe(true);
  expect(fireEvent.wheel(preview)).toBe(true);
  expect(fireEvent.contextMenu(preview)).toBe(true);
});
