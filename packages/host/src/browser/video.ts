import type { BrowserImports } from "@druid-ui/client/types";
import { Resources } from "./resources";
import type { Surfaces } from "./surfaces";

type Decoder = { decoder: VideoDecoder; error?: string };
export function video(
  surfaces: Surfaces,
  resources: Resources,
): BrowserImports["druid:openui/video"] {
  const players = new Map<string, number>();
  const player = (id: number) => resources.get<HTMLVideoElement>(id, "video");
  const decoder = (id: number) => {
    const d = resources.get<Decoder>(id, "video-decoder");
    if (d.error) throw new Error(d.error);
    return d.decoder;
  };
  return {
    open(id, url, muted, looping) {
      if (players.has(id))
        throw new Error(`Video surface is already open: ${id}`);
      const parsed = new URL(url, document.baseURI);
      if (!["https:", "http:", "blob:"].includes(parsed.protocol))
        throw new Error("Video requires an HTTP(S) or blob URL");
      const element = surfaces.video(id);
      element.muted = muted;
      element.loop = looping;
      element.src = parsed.href;
      const handle = resources.add("video", element, () => {
        element.pause();
        element.removeAttribute("src");
        element.load();
        element.remove();
        surfaces.removeVideo(id);
        players.delete(id);
      });
      players.set(id, handle);
      return handle;
    },
    play: (id) => player(id).play(),
    pause: (id) => player(id).pause(),
    seek(id, seconds) {
      player(id).currentTime = seconds;
    },
    status(id) {
      const v = player(id);
      return {
        width: v.videoWidth,
        height: v.videoHeight,
        time: v.currentTime,
        duration: v.duration,
        paused: v.paused,
        ended: v.ended,
      };
    },
    drawFrame(id, surface) {
      surfaces.context2d(surface).drawImage(player(id), 0, 0);
    },
    async createDecoder(surface, codec, width, height, description) {
      if (typeof VideoDecoder === "undefined")
        throw new Error("WebCodecs VideoDecoder unavailable");
      const ctx = surfaces.context2d(surface);
      const config: VideoDecoderConfig = {
        codec,
        codedWidth: width,
        codedHeight: height,
        ...(description.length ? { description: description.slice() } : {}),
      };
      if (!(await VideoDecoder.isConfigSupported(config)).supported)
        throw new Error(`Unsupported video codec: ${codec}`);
      const state: Decoder = { decoder: undefined! };
      state.decoder = new VideoDecoder({
        output(frame) {
          try {
            ctx.drawImage(frame, 0, 0);
          } finally {
            frame.close();
          }
        },
        error(error) {
          state.error = error.message;
        },
      });
      try {
        state.decoder.configure(config);
        return resources.add("video-decoder", state, () => {
          if (state.decoder.state !== "closed") state.decoder.close();
        });
      } catch (error) {
        if (state.decoder.state !== "closed") state.decoder.close();
        throw error;
      }
    },
    decode(id, key, timestamp, duration, data) {
      decoder(id).decode(
        new EncodedVideoChunk({
          type: key ? "key" : "delta",
          timestamp,
          ...(duration === undefined ? {} : { duration }),
          data: data as Uint8Array<ArrayBuffer>,
        }),
      );
    },
    queueSize: (id) => decoder(id).decodeQueueSize,
    flush: (id) => decoder(id).flush(),
    close: (id) => resources.remove(id),
  };
}
