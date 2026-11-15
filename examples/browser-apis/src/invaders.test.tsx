import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Renderer, useSetFieldValue } from "@openuidev/react-lang";
import { afterEach, expect, it, vi } from "vitest";
import { library } from "./library";
import document from "./invaders.openui?raw";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup() {
  const actions = vi.fn();
  let update = () => {};
  function Probe() {
    const set = useSetFieldValue();
    update = () => set(undefined, undefined, "$invadersScore", "000030");
    return null;
  }
  render(
    <Renderer.Root library={library} response={document} onAction={actions}>
      <Probe />
      <Renderer.Content />
    </Renderer.Root>,
  );
  return { actions, update };
}
it("renders the real arcade document, inert canvas, HUD and loop startup once", async () => {
  const { actions, update } = setup();
  expect(
    screen.getByRole("heading", { name: "Space Invaders." }),
  ).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("AWAITING PILOT");
  expect(
    screen.getByText("Canvas unavailable in this preview"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("group", { name: "Space Invaders keyboard controls" }),
  ).not.toHaveAttribute("tabindex");
  await act(async () => update());
  expect(screen.getByText("000030")).toBeInTheDocument();
  expect(
    actions.mock.calls.filter(([event]) => event.type === "StartInvaders"),
  ).toHaveLength(1);
});
it("sends exact held-input parameters and releases on up, cancellation and blur", () => {
  const { actions } = setup();
  const button = screen.getByRole("button", { name: "← Move left" });
  Object.defineProperty(button, "setPointerCapture", { value: vi.fn() });
  fireEvent.pointerDown(button, { pointerId: 1 });
  expect(actions).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: "InputInvaders",
      params: { code: "ArrowLeft", pressed: true },
    }),
  );
  for (const release of [
    () => fireEvent.pointerUp(button),
    () => fireEvent.pointerCancel(button),
    () => fireEvent.lostPointerCapture(button),
    () => fireEvent.blur(button),
  ]) {
    release();
    expect(actions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "InputInvaders",
        params: { code: "ArrowLeft", pressed: false },
      }),
    );
  }
  const fire = screen.getByRole("button", { name: "Fire" });
  fireEvent.keyDown(fire, { code: "Space", repeat: false });
  expect(actions).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: "InputInvaders",
      params: { code: "Space", pressed: true },
    }),
  );
  const count = actions.mock.calls.length;
  fireEvent.keyDown(fire, { code: "Space", repeat: true });
  expect(actions.mock.calls.length).toBe(count);
  fireEvent.keyUp(fire, { code: "Space" });
  expect(actions).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: "InputInvaders",
      params: { code: "Space", pressed: false },
    }),
  );
});
it("routes pause, restart and sound through guest actions", () => {
  const { actions } = setup();
  for (const [name, type] of [
    ["Restart mission", "RestartInvaders"],
    ["Pause", "PauseInvaders"],
    ["Sound off", "SoundInvaders"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name }));
    expect(actions).toHaveBeenLastCalledWith(
      expect.objectContaining({ type, params: {} }),
    );
  }
});
