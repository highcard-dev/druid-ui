import { createContext, useContext, useLayoutEffect, useRef } from "react";
import { dimensions, Resources } from "./resources";

export class Surfaces {
  private canvases = new Map<string, number>();
  private videos = new Map<string, HTMLVideoElement>();
  constructor(private resources: Resources) {}
  canvas(id: string, width: number, height: number) {
    dimensions(width, height);
    const existing = this.canvases.get(id);
    if (existing !== undefined) return existing;
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    element.style.maxWidth = "100%";
    // Backing-store changes must not change CSS layout and trigger resize feedback.
    element.style.width = `${width}px`;
    element.style.height = "auto";
    element.style.display = "block";
    const handle = this.resources.add("canvas", element, () => {
      element.remove();
      element.width = element.height = 0;
      this.canvases.delete(id);
    });
    this.canvases.set(id, handle);
    return handle;
  }
  getCanvas(handle: number) {
    return this.resources.get<HTMLCanvasElement>(handle, "canvas");
  }
  context2d(handle: number) {
    const context = this.getCanvas(handle).getContext("2d");
    if (!context)
      throw new Error(
        "Canvas 2D unavailable or surface already uses a different context",
      );
    return context;
  }
  video(id: string) {
    let element = this.videos.get(id);
    if (!element) {
      element = document.createElement("video");
      element.controls = true;
      element.playsInline = true;
      element.preload = "metadata";
      element.crossOrigin = "anonymous";
      element.style.maxWidth = "100%";
      this.videos.set(id, element);
    }
    return element;
  }
  removeVideo(id: string) {
    this.videos.delete(id);
  }
}

export const BrowserSurfacesContext = createContext<Surfaces | null>(null);

/** Register these in any OpenUI library. No Druid platform providers are needed. */
export function BrowserCanvas({
  id,
  width = 640,
  height = 360,
  label = "Canvas",
}: {
  id: string;
  width?: number;
  height?: number;
  label?: string;
}) {
  const surfaces = useContext(BrowserSurfacesContext);
  const mount = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!surfaces) return;
    const element = surfaces.getCanvas(surfaces.canvas(id, width, height));
    element.setAttribute("aria-label", label);
    mount.current?.append(element);
    return () => {
      element.remove();
    };
  }, [surfaces, id, width, height, label]);
  return (
    <div ref={mount} role="group" aria-label={label}>
      {!surfaces && "Canvas unavailable in this preview"}
    </div>
  );
}

export function BrowserVideo({
  id,
  label = "Video",
}: {
  id: string;
  label?: string;
}) {
  const surfaces = useContext(BrowserSurfacesContext);
  const mount = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!surfaces) return;
    const element = surfaces.video(id);
    element.setAttribute("aria-label", label);
    mount.current?.append(element);
    return () => {
      element.remove();
    };
  }, [surfaces, id, label]);
  return (
    <div ref={mount} role="group" aria-label={label}>
      {!surfaces && "Video unavailable in this preview"}
    </div>
  );
}
