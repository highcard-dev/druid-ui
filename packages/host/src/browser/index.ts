import type { BrowserImports } from "@druid-ui/client/types";
import { Resources, imports } from "./resources";
import { Surfaces } from "./surfaces";
import { canvas } from "./canvas";
import { webgl } from "./webgl";
import { webgpu } from "./webgpu";
import { audio } from "./audio";
import { video } from "./video";
import { http, type ConfirmHttpRequest } from "./http";

export interface BrowserInterop {
  imports: BrowserImports;
  surfaces: Surfaces;
}

/** Standard browser imports. Lifetime is exactly the guest's AbortSignal. */
export function createBrowserInterop(
  signal: AbortSignal,
  confirmHttpRequest?: ConfirmHttpRequest,
): BrowserInterop {
  const resources = new Resources(signal),
    surfaces = new Surfaces(resources);
  return {
    surfaces,
    imports: {
      "druid:openui/http": imports(http(signal, confirmHttpRequest), signal),
      "druid:openui/canvas": imports(canvas(surfaces, resources), signal),
      "druid:openui/webgl": imports(webgl(surfaces, resources), signal),
      "druid:openui/webgpu": imports(webgpu(surfaces, resources), signal),
      "druid:openui/audio": imports(audio(resources, signal), signal),
      "druid:openui/video": imports(video(surfaces, resources), signal),
      "druid:openui/animation": imports(
        {
          now: () => performance.now(),
          nextFrame: () =>
            new Promise<number>((resolve, reject) => {
              const abort = () => {
                cancelAnimationFrame(id);
                reject(signal.reason);
              };
              const id = requestAnimationFrame((timestamp) => {
                signal.removeEventListener("abort", abort);
                resolve(timestamp);
              });
              signal.addEventListener("abort", abort, { once: true });
            }),
        },
        signal,
      ),
    },
  };
}
