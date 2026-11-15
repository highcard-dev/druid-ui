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
import document from "./view.openui?raw";

afterEach(() => cleanup());

it("renders the actual gallery document with six inert preview scenes and guest controls", async () => {
  const actions = vi.fn();
  render(
    <Renderer.Root library={library} response={document} onAction={actions}>
      <Renderer.Content />
    </Renderer.Root>,
  );
  expect(screen.getAllByRole("article")).toHaveLength(6);
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
  expect(
    screen.getAllByText("Canvas unavailable in this preview"),
  ).toHaveLength(6);
  expect(
    screen.getByText("Video unavailable in this preview"),
  ).toBeInTheDocument();
  expect(actions).toHaveBeenCalledWith(
    expect.objectContaining({ type: "StartGallery" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Enable sound" }));
  expect(actions).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "ToggleSound" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Pause motion" }));
  expect(actions).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "ToggleMotion" }),
  );
});

it("does not restart the animation loop when telemetry changes", async () => {
  const actions = vi.fn();
  let update = () => {};
  function Probe() {
    const set = useSetFieldValue();
    update = () => set(undefined, undefined, "$fps", "120");
    return null;
  }
  render(
    <Renderer.Root library={library} response={document} onAction={actions}>
      <Probe />
      <Renderer.Content />
    </Renderer.Root>,
  );
  await act(async () => update());
  expect(screen.getByText("120")).toBeInTheDocument();
  expect(
    actions.mock.calls.filter(([event]) => event.type === "StartGallery"),
  ).toHaveLength(1);
});
