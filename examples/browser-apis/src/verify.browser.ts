// Browser-only integration checks. Not imported by the demo or production host.
import { createBrowserInterop } from "@druid-ui/host";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Host-path benchmark; the demo's Rust action separately measures WIT overhead. */
export async function verifyAnimation() {
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const api = browser.imports["druid:openui/canvas"],
    animation = browser.imports["druid:openui/animation"];
  const id = api.open("benchmark", 320, 180),
    element = browser.surfaces.getCanvas(id);
  element.style.position = "fixed";
  element.style.top = "0";
  element.style.left = "0";
  document.body.append(element);
  const rectangles = new Float32Array(4000),
    times: number[] = [];
  for (let i = 0; i < 1000; i++) {
    rectangles.set([i % 320, Math.floor(i / 320), 2, 2], i * 4);
  }
  const start = await animation.nextFrame();
  let last = start;
  try {
    for (let frame = 0; frame < 180; frame++) {
      last = await animation.nextFrame();
      for (let i = 1; i < rectangles.length; i += 4)
        rectangles[i] = (rectangles[i]! + 1) % 180;
      const before = performance.now();
      api.fillRects(id, rectangles, frame % 2 ? "#19334d" : "#336699");
      times.push(performance.now() - before);
    }
    times.sort((a, b) => a - b);
    return {
      frames: 180,
      rectangles_per_frame: 1000,
      fps: 180000 / (last - start),
      host_p50_ms: times[90],
      host_p95_ms: times[171],
    };
  } finally {
    controller.abort();
  }
}
const dsp = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 3, 127, 127, 125, 0, 3, 2, 1, 0, 5,
  3, 1, 0, 1, 7, 20, 2, 6, 109, 101, 109, 111, 114, 121, 2, 0, 7, 112, 114, 111,
  99, 101, 115, 115, 0, 0, 10, 41, 1, 39, 1, 2, 127, 32, 0, 32, 1, 108, 65, 4,
  108, 33, 4, 3, 64, 32, 3, 67, 10, 215, 163, 60, 56, 2, 0, 32, 3, 65, 4, 106,
  34, 3, 32, 4, 73, 13, 0, 11, 11,
]);

export async function verifyBrowserHost() {
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const audio = browser.imports["druid:openui/audio"],
    video = browser.imports["druid:openui/video"];
  let context: AudioContext | undefined;
  const OriginalAudioContext = window.AudioContext;
  window.AudioContext = class extends OriginalAudioContext {
    constructor(options?: AudioContextOptions) {
      super(options);
      context = this;
    }
  };
  let contextId: number;
  try {
    contextId = audio.open(48000);
  } finally {
    window.AudioContext = OriginalAudioContext;
  }
  const ctx = context!;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  // Observe actual worklet output, without replacing the processing implementation.
  const connect = AudioWorkletNode.prototype.connect;
  AudioWorkletNode.prototype.connect = function (
    this: AudioWorkletNode,
    destination: AudioNode,
    output?: number,
    input?: number,
  ) {
    Reflect.apply(connect, this, [analyser, 0, 0]);
    return Reflect.apply(connect, this, [destination, output ?? 0, input ?? 0]);
  } as typeof connect;
  let voice: number;
  try {
    await audio.resume(contextId);
    voice = await audio.startProcessor(contextId, dsp, 1);
  } finally {
    AudioWorkletNode.prototype.connect = connect;
  }
  try {
    const samples = new Float32Array(256);
    for (let i = 0; i < 50; i++) {
      analyser.getFloatTimeDomainData(samples);
      if (samples.some((value) => Math.abs(value - 0.02) < 0.001)) break;
      await delay(20);
    }
    const sample = samples.find((value) => Math.abs(value - 0.02) < 0.001);
    assert(
      sample !== undefined,
      "AudioWorklet did not produce the DSP's expected PCM samples",
    );
    audio.stop(voice);
    // Exercise browser decoding with a tiny real PCM WAV.
    const wav = new ArrayBuffer(44 + 128 * 2),
      header = new DataView(wav);
    const text = (offset: number, value: string) =>
      [...value].forEach((c, i) =>
        header.setUint8(offset + i, c.charCodeAt(0)),
      );
    text(0, "RIFF");
    header.setUint32(4, wav.byteLength - 8, true);
    text(8, "WAVEfmt ");
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true);
    header.setUint16(22, 1, true);
    header.setUint32(24, 48000, true);
    header.setUint32(28, 96000, true);
    header.setUint16(32, 2, true);
    header.setUint16(34, 16, true);
    text(36, "data");
    header.setUint32(40, 256, true);
    const decoded = await audio.decode(contextId, new Uint8Array(wav));
    audio.close(decoded);
    audio.close(contextId);

    // Build a local media fixture instead of downloading someone else's video.
    const source = document.createElement("canvas");
    source.width = source.height = 32;
    const drawing = source.getContext("2d")!;
    drawing.fillStyle = "#ff0000";
    drawing.fillRect(0, 0, 32, 32);
    const stream = source.captureStream(30),
      chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
    });
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () =>
        reject(new Error("Media fixture recording failed"));
    });
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    await delay(150);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
    try {
      const id = video.open("recording", url, true, false);
      await video.play(id);
      const info = video.status(id);
      assert(
        info.width === 32 && info.height === 32,
        "Video player metadata mismatch",
      );
      const surface = browser.imports["druid:openui/canvas"].open(
        "frame",
        32,
        32,
      );
      video.drawFrame(id, surface);
      const pixel = browser.imports["druid:openui/canvas"].readPixels(
        surface,
        0,
        0,
        1,
        1,
      );
      assert(
        pixel[0]! > 240 && pixel[1]! < 16,
        "Video playback/frame drawing failed",
      );
      video.pause(id);
      video.seek(id, 0);
      video.close(id);
      return {
        audio_worklet_sample: sample,
        audio_decode: true,
        video_playback: true,
        video_pixel: Array.from(pixel),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    controller.abort();
    analyser.disconnect();
  }
}
