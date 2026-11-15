import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { BrowserCanvas, BrowserVideo } from "./surfaces";
import { BrowserKeyboard } from "./keyboard";
import { BrowserPointer, pointerEvents } from "./pointer";
import { BrowserViewport, BrowserOverlay } from "./viewport";

export const Canvas = defineComponent({
  name: "Canvas",
  description:
    "A WASM-controlled drawing surface. Width and height are backing pixels, not layout styling. Use its instance-local id with the canvas WIT interface.",
  props: z.object({
    id: z.string(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    label: z.string().optional(),
  }),
  component: ({ props }) => (
    <BrowserCanvas
      {...props}
      label={props.label ?? `${props.id} illustration`}
    />
  ),
});

export const Video = defineComponent({
  name: "Video",
  description:
    "A WASM-controlled video surface, matched by instance-local id to the video WIT interface.",
  props: z.object({ id: z.string(), label: z.string().optional() }),
  component: ({ props }) => <BrowserVideo {...props} />,
});

export const Keyboard = defineComponent({
  name: "Keyboard",
  description:
    "A focus-scoped keyboard region. Send only the listed physical codes to the guest's exported keyboard.handle-event. Native controls and typing remain unaffected. Inert without a running keyboard-enabled guest.",
  props: z.object({
    id: z.string(),
    codes: z.array(z.string()),
    children: z.array(z.unknown()),
    label: z.string().optional(),
  }),
  component: ({ props, renderNode }) => (
    <BrowserKeyboard id={props.id} codes={props.codes} label={props.label}>
      {renderNode(props.children)}
    </BrowserKeyboard>
  ),
});

export const Pointer = defineComponent({
  name: "Pointer",
  description:
    "A region-scoped pointer listener. Events are typed mouse/pen/touch input to the guest's pointer.handle-event, with region-relative CSS coordinates. Moves coalesce once per pointer/frame; down/up and wheel are immediate. Captures drags, ignores native controls and stays inert without a pointer-enabled guest. Cancel/blur release held state regardless of selected events.",
  props: z.object({
    id: z.string(),
    events: z.array(z.enum(pointerEvents)),
    children: z.array(z.unknown()),
    label: z.string().optional(),
    preventContextMenu: z.boolean().optional(),
  }),
  component: ({ props, renderNode }) => (
    <BrowserPointer {...props}>{renderNode(props.children)}</BrowserPointer>
  ),
});

export const Viewport = defineComponent({
  name: "Viewport",
  description:
    "A drawing surface with in-viewport UI. Surface determines its dimensions; compose Overlay children for accessible game HUDs and menus. No clipping or positioning outside this viewport.",
  props: z.object({ surface: z.unknown(), children: z.array(z.unknown()) }),
  component: ({ props, renderNode }) => (
    <BrowserViewport surface={renderNode(props.surface)}>
      {renderNode(props.children)}
    </BrowserViewport>
  ),
});

export const Overlay = defineComponent({
  name: "Overlay",
  description:
    "Controls inside a Viewport, anchored top, bottom or center. Center panels are width-bounded and scroll within the viewport. Set interactive=false for a click-through HUD. Use normal components for content.",
  props: z.object({
    position: z.enum(["top", "bottom", "center"]),
    children: z.array(z.unknown()),
    interactive: z.boolean().optional(),
  }),
  component: ({ props, renderNode }) => (
    <BrowserOverlay {...props}>{renderNode(props.children)}</BrowserOverlay>
  ),
});

/** Shared OpenUI definitions: register once in any host library. */
export const browserComponents = [
  Canvas,
  Video,
  Keyboard,
  Pointer,
  Viewport,
  Overlay,
];
