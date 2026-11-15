import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { PointerEvent as Input } from "@druid-ui/client/types";
import { interactive } from "./input-target";

export const PointerContext = createContext<((event: Input) => void) | null>(
  null,
);
export const pointerEvents = [
  "down",
  "up",
  "move",
  "enter",
  "leave",
  "click",
  "double-click",
  "wheel",
  "cancel",
  "blur",
] as const;

/** Opt-in, instance-local pointer scope; never watches the rest of the page. */
export function BrowserPointer({
  id,
  events,
  label = "Pointer controls",
  preventContextMenu = false,
  children,
}: {
  id: string;
  events: readonly Input["kind"][];
  label?: string;
  preventContextMenu?: boolean;
  children: ReactNode;
}) {
  const dispatch = useContext(PointerContext),
    region = useRef<HTMLDivElement>(null);
  const active = !!dispatch && events.length > 0;
  const selected = useRef(events);
  selected.current = events;
  useEffect(() => {
    const element = region.current;
    if (!dispatch || !element || !active) return;
    const captured = new Set<number>(),
      pending = new Map<number, Input>();
    const positions = new Map<number, { x: number; y: number }>();
    let frame: number | undefined, last: Input | undefined;
    const flush = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      for (const value of pending.values()) dispatch(value);
      pending.clear();
    };
    const value = (event: MouseEvent, kind: Input["kind"]): Input => {
      const bounds = element.getBoundingClientRect();
      const p = event instanceof PointerEvent ? event : undefined;
      const x = event.clientX - bounds.left,
        y = event.clientY - bounds.top;
      const previous = p ? positions.get(p.pointerId) : undefined;
      if (p) positions.set(p.pointerId, { x, y });
      return {
        region: id,
        kind,
        pointerId: p?.pointerId ?? 0,
        device:
          p && ["mouse", "pen", "touch"].includes(p.pointerType)
            ? (p.pointerType as Input["device"])
            : p
              ? "unknown"
              : "mouse",
        x,
        y,
        width: bounds.width,
        height: bounds.height,
        movementX: kind === "move" && previous ? x - previous.x : 0,
        movementY: kind === "move" && previous ? y - previous.y : 0,
        wheelX: 0,
        wheelY: 0,
        button: kind === "wheel" ? -1 : event.button,
        buttons: event.buttons,
        pressure: p?.pressure ?? (event.buttons ? 0.5 : 0),
        shift: event.shiftKey,
        control: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey,
        timestamp: event.timeStamp,
      };
    };
    const accepts = (event: Event) =>
      !event.defaultPrevented &&
      !interactive(event.target) &&
      event.target instanceof Element &&
      event.target.closest("[data-druid-pointer]") === element;
    const pointer = (kind: Input["kind"], event: PointerEvent) => {
      if (
        !accepts(event) ||
        (!selected.current.includes(kind) && kind !== "cancel")
      )
        return;
      event.stopPropagation();
      const next = value(event, kind);
      last = next;
      if (kind === "move") {
        const previous = pending.get(next.pointerId);
        if (previous) {
          next.movementX += previous.movementX;
          next.movementY += previous.movementY;
        }
        pending.set(next.pointerId, next);
        if (frame === undefined) frame = requestAnimationFrame(flush);
        return;
      }
      flush();
      if (kind === "down") {
        element.focus({ preventScroll: true });
        element.setPointerCapture(event.pointerId);
        captured.add(event.pointerId);
        event.preventDefault();
      }
      if (kind === "up" || kind === "cancel") {
        if (kind === "cancel") {
          next.buttons = 0;
          next.pressure = 0;
        }
        captured.delete(event.pointerId);
        if (element.hasPointerCapture(event.pointerId))
          element.releasePointerCapture(event.pointerId);
      }
      dispatch(next);
      if (
        kind === "up" ||
        kind === "cancel" ||
        (kind === "leave" && !captured.has(event.pointerId))
      )
        positions.delete(event.pointerId);
    };
    const reset = (event: Event) => {
      flush();
      if (last)
        dispatch({
          ...last,
          kind: "blur",
          buttons: 0,
          pressure: 0,
          button: -1,
          movementX: 0,
          movementY: 0,
          wheelX: 0,
          wheelY: 0,
          timestamp: event.timeStamp,
        });
      last = undefined;
      for (const id of captured)
        if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      captured.clear();
      positions.clear();
    };
    const handlers = {
      pointerdown: (e: PointerEvent) => pointer("down", e),
      pointerup: (e: PointerEvent) => {
        // Always finish an accepted drag even if up wasn't explicitly requested.
        if (captured.has(e.pointerId) && !selected.current.includes("up")) {
          flush();
          captured.delete(e.pointerId);
          if (element.hasPointerCapture(e.pointerId))
            element.releasePointerCapture(e.pointerId);
          dispatch({ ...value(e, "cancel"), buttons: 0, pressure: 0 });
        } else pointer("up", e);
        positions.delete(e.pointerId);
      },
      pointermove: (e: PointerEvent) => pointer("move", e),
      pointerenter: (e: PointerEvent) => pointer("enter", e),
      pointerleave: (e: PointerEvent) => pointer("leave", e),
      pointercancel: (e: PointerEvent) => pointer("cancel", e),
      lostpointercapture: (e: PointerEvent) => {
        if (captured.delete(e.pointerId)) {
          flush();
          dispatch({ ...value(e, "cancel"), buttons: 0, pressure: 0 });
          positions.delete(e.pointerId);
        }
      },
      click: (e: MouseEvent) => {
        if (accepts(e) && selected.current.includes("click")) {
          flush();
          e.stopPropagation();
          dispatch(value(e, "click"));
        }
      },
      dblclick: (e: MouseEvent) => {
        if (accepts(e) && selected.current.includes("double-click")) {
          flush();
          e.stopPropagation();
          dispatch(value(e, "double-click"));
        }
      },
      wheel: (e: WheelEvent) => {
        if (!accepts(e) || !selected.current.includes("wheel")) return;
        flush();
        e.stopPropagation();
        if (!e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
        const next = value(e, "wheel"),
          scale = e.deltaMode === 1 ? 16 : 1;
        next.wheelX = e.deltaX * (e.deltaMode === 2 ? next.width : scale);
        next.wheelY = e.deltaY * (e.deltaMode === 2 ? next.height : scale);
        last = next;
        dispatch(next);
      },
      contextmenu: (e: MouseEvent) => {
        if (preventContextMenu && accepts(e)) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      focusout: (e: FocusEvent) => {
        if (
          !element.contains(e.relatedTarget as Node | null) ||
          interactive(e.relatedTarget)
        )
          reset(e);
      },
    };
    for (const [name, handler] of Object.entries(handlers))
      element.addEventListener(name, handler as EventListener, {
        passive: false,
      });
    const blur = (e: Event) => {
      if (captured.size || element.contains(document.activeElement)) reset(e);
    };
    window.addEventListener("blur", blur);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      pending.clear();
      for (const [name, handler] of Object.entries(handlers))
        element.removeEventListener(name, handler as EventListener);
      window.removeEventListener("blur", blur);
      for (const id of captured)
        if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    };
  }, [dispatch, id, preventContextMenu, active]);
  return (
    <div
      ref={region}
      data-druid-pointer={id}
      role="group"
      aria-label={label}
      tabIndex={active ? 0 : undefined}
      style={active ? { touchAction: "none" } : undefined}
    >
      {children}
    </div>
  );
}
