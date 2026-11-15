import type { BrowserImports } from "@druid-ui/client/types";
import { dimensions, Resources } from "./resources";
import type { Surfaces } from "./surfaces";

export function canvas(
  surfaces: Surfaces,
  resources: Resources,
): BrowserImports["druid:openui/canvas"] {
  return {
    open: (id, width, height) => surfaces.canvas(id, width, height),
    resize(handle, width, height) {
      dimensions(width, height);
      const element = surfaces.getCanvas(handle);
      element.width = width;
      element.height = height;
    },
    getMetrics(handle) {
      const element = surfaces.getCanvas(handle);
      const rect = element.getBoundingClientRect();
      return {
        cssWidth: rect.width,
        cssHeight: rect.height,
        pixelRatio: window.devicePixelRatio || 1,
        backingWidth: element.width,
        backingHeight: element.height,
      };
    },
    draw(handle, commands) {
      const ctx = surfaces.context2d(handle);
      for (const command of commands) {
        switch (command.tag) {
          case "clear": {
            const r = command.val;
            ctx.clearRect(r.x, r.y, r.width, r.height);
            break;
          }
          case "fill-rect":
          case "stroke-rect": {
            const { bounds: r, color } = command.val;
            if (command.tag === "fill-rect") {
              ctx.fillStyle = color;
              ctx.fillRect(r.x, r.y, r.width, r.height);
            } else {
              ctx.strokeStyle = color;
              ctx.strokeRect(r.x, r.y, r.width, r.height);
            }
            break;
          }
          case "begin-path":
            ctx.beginPath();
            break;
          case "move-to":
            ctx.moveTo(command.val.x, command.val.y);
            break;
          case "line-to":
            ctx.lineTo(command.val.x, command.val.y);
            break;
          case "close-path":
            ctx.closePath();
            break;
          case "fill":
            ctx.fillStyle = command.val;
            ctx.fill();
            break;
          case "stroke":
            ctx.strokeStyle = command.val;
            ctx.stroke();
            break;
          case "line-width":
            ctx.lineWidth = command.val;
            break;
          case "fill-text": {
            const t = command.val;
            ctx.font = t.font;
            ctx.fillStyle = t.color;
            ctx.fillText(t.value, t.at.x, t.at.y);
            break;
          }
          case "save":
            ctx.save();
            break;
          case "restore":
            ctx.restore();
            break;
        }
      }
    },
    fillRects(handle, rectangles, color) {
      if (rectangles.length % 4)
        throw new Error("Rectangles require x,y,width,height tuples");
      const ctx = surfaces.context2d(handle);
      ctx.fillStyle = color;
      for (let i = 0; i < rectangles.length; i += 4)
        ctx.fillRect(
          rectangles[i]!,
          rectangles[i + 1]!,
          rectangles[i + 2]!,
          rectangles[i + 3]!,
        );
    },
    writePixels(handle, rgba, width, height, x, y) {
      dimensions(width, height);
      if (rgba.length !== width * height * 4)
        throw new Error("RGBA length does not match dimensions");
      // ImageData needs clamped bytes. No JSON/base64 and no per-pixel host calls.
      const bytes = new Uint8ClampedArray(
        rgba.buffer,
        rgba.byteOffset,
        rgba.byteLength,
      );
      surfaces
        .context2d(handle)
        .putImageData(
          new ImageData(bytes as Uint8ClampedArray<ArrayBuffer>, width, height),
          x,
          y,
        );
    },
    readPixels: (handle, x, y, w, h) =>
      new Uint8Array(surfaces.context2d(handle).getImageData(x, y, w, h).data),
    close: (handle) => {
      surfaces.getCanvas(handle);
      resources.remove(handle);
    },
  };
}
