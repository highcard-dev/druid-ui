import type { BrowserImports } from "@druid-ui/client/types";
import { Resources } from "./resources";

type Point = { x: number; y: number; z: number };
type Spatial = {
  position: Point;
  refDistance: number;
  maxDistance: number;
  rolloff: number;
};
type Voice = {
  context: AudioContext;
  gain: GainNode;
  panner: PannerNode | undefined;
};
type Pool = { gain: GainNode; panner: PannerNode | undefined };
const MAX_VOICES = 64;
const MAX_POOLED_NODES = 32;
const finitePoint = (p: Point) => [p.x, p.y, p.z].every(Number.isFinite);
function position(node: AudioListener | PannerNode, p: Point) {
  node.positionX.value = p.x;
  node.positionY.value = p.y;
  node.positionZ.value = p.z;
}

// Isolated real-time path: no React, JSON, IPC or allocation per audio quantum.
const processorSource = `
class DruidDSP extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.instance = new WebAssembly.Instance(options.processorOptions.module, {});
    const { memory, process } = this.instance.exports;
    if (!(memory instanceof WebAssembly.Memory) || typeof process !== 'function') throw new Error('DSP must export memory and process');
    this.memory = memory.buffer;
    this.samples = new Float32Array(this.memory);
    this.render = process;
    this.stopped = false;
    this.port.onmessage = (event) => { if (event.data === 'stop') this.stopped = true; };
    if (this.samples.length < options.outputChannelCount[0] * 128) throw new Error('DSP memory is too small');
    this.port.postMessage('ready');
  }
  process(inputs, outputs) {
    if (this.stopped) return false;
    const output = outputs[0];
    const frames = output[0].length;
    if (frames * output.length > this.samples.length) return false;
    this.render(frames, output.length, sampleRate);
    if (this.instance.exports.memory.buffer !== this.memory) return false;
    for (let channel = 0; channel < output.length; channel++) {
      const offset = channel * frames;
      for (let i = 0; i < frames; i++) output[channel][i] = this.samples[offset + i];
    }
    return true;
  }
}
registerProcessor('druid-dsp', DruidDSP);
`;

export function audio(
  resources: Resources,
  signal: AbortSignal,
): BrowserImports["druid:openui/audio"] {
  const worklets = new WeakMap<AudioContext, Promise<void>>();
  const buffers = new WeakMap<AudioBuffer, AudioContext>();
  const states = new WeakMap<
    AudioContext,
    { active: Set<number>; pool: Pool[] }
  >();
  const getContext = (id: number) =>
    resources.get<AudioContext>(id, "audio-context");
  const start = (
    id: number,
    bufferId: number,
    when: number,
    gainValue: number,
    looping: boolean,
    spatial?: Spatial,
  ) => {
    const context = getContext(id);
    const buffer = resources.get<AudioBuffer>(bufferId, "audio-buffer");
    if (!Number.isFinite(gainValue)) throw new Error("Invalid audio gain");
    if (buffers.get(buffer) !== context)
      throw new Error("Audio buffer belongs to another context");
    if (
      spatial &&
      (!finitePoint(spatial.position) ||
        !Number.isFinite(spatial.refDistance) ||
        !Number.isFinite(spatial.maxDistance) ||
        !Number.isFinite(spatial.rolloff) ||
        spatial.refDistance <= 0 ||
        spatial.maxDistance < spatial.refDistance ||
        spatial.rolloff < 0)
    )
      throw new Error("Invalid spatial audio source");
    const state = states.get(context)!;
    if (state.active.size >= MAX_VOICES)
      throw new Error("Audio context exceeds 64 active buffer voices");
    const index = state.pool.findIndex(
      (nodes) => Boolean(nodes.panner) === Boolean(spatial),
    );
    const pooled = index < 0 ? undefined : state.pool.splice(index, 1)[0];
    const gain = pooled?.gain ?? context.createGain();
    const panner = spatial
      ? (pooled?.panner ?? context.createPanner())
      : undefined;
    const source = context.createBufferSource(); // Web Audio sources are single-use.
    source.buffer = buffer;
    source.loop = looping;
    gain.gain.value = gainValue;
    source.connect(gain);
    if (panner && spatial) {
      panner.panningModel = "equalpower";
      panner.distanceModel = "inverse";
      panner.refDistance = spatial.refDistance;
      panner.maxDistance = spatial.maxDistance;
      panner.rolloffFactor = spatial.rolloff;
      position(panner, spatial.position);
      gain.connect(panner);
      panner.connect(context.destination);
    } else gain.connect(context.destination);
    let stopped = false;
    let voice = 0;
    const stop = () => {
      source.onended = null;
      if (!stopped) {
        stopped = true;
        source.stop();
      }
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      state.active.delete(voice);
      if (!signal.aborted && state.pool.length < MAX_POOLED_NODES)
        state.pool.push({ gain, panner });
    };
    voice = resources.add<Voice>(
      "audio-voice",
      { context, gain, panner },
      stop,
    );
    state.active.add(voice);
    source.onended = () => {
      stopped = true;
      resources.remove(voice);
    };
    try {
      source.start(when);
    } catch (error) {
      stopped = true;
      resources.remove(voice);
      throw error;
    }
    return voice;
  };
  return {
    open(sampleRate) {
      const context = new AudioContext(
        sampleRate === undefined ? {} : { sampleRate },
      );
      states.set(context, { active: new Set(), pool: [] });
      return resources.add("audio-context", context, () => {
        const state = states.get(context)!;
        for (const voice of [...state.active]) resources.remove(voice);
        state.pool.length = 0;
        void context.close();
      });
    },
    resume: (id) => getContext(id).resume(),
    suspend: (id) => getContext(id).suspend(),
    time: (id) => getContext(id).currentTime,
    createBuffer(id, channels, frames, sampleRate) {
      const context = getContext(id);
      const buffer = context.createBuffer(channels, frames, sampleRate);
      buffers.set(buffer, context);
      return resources.add("audio-buffer", buffer);
    },
    writeChannel(id, channel, samples, offset) {
      const buffer = resources.get<AudioBuffer>(id, "audio-buffer");
      if (offset + samples.length > buffer.length)
        throw new Error("Audio samples exceed channel length");
      buffer.copyToChannel(
        samples as Float32Array<ArrayBuffer>,
        channel,
        offset,
      );
    },
    async decode(id, encoded) {
      const context = getContext(id);
      const buffer = await context.decodeAudioData(encoded.slice().buffer);
      buffers.set(buffer, context);
      return resources.add("audio-buffer", buffer);
    },
    play: (id, buffer, when, gain, looping) =>
      start(id, buffer, when, gain, looping),
    playAt: (id, buffer, when, gain, looping, spatial) =>
      start(id, buffer, when, gain, looping, spatial),
    setListener(id, listener) {
      if (
        ![listener.position, listener.forward, listener.up].every(finitePoint)
      )
        throw new Error("Invalid audio listener vectors");
      const node = getContext(id).listener;
      position(node, listener.position);
      node.forwardX.value = listener.forward.x;
      node.forwardY.value = listener.forward.y;
      node.forwardZ.value = listener.forward.z;
      node.upX.value = listener.up.x;
      node.upY.value = listener.up.y;
      node.upZ.value = listener.up.z;
    },
    updateVoices(id, updates) {
      const context = getContext(id);
      const voices = updates.map((update) => {
        const voice = resources.get<Voice>(update.voice, "audio-voice");
        if (voice.context !== context || !voice.panner)
          throw new Error(
            "Spatial voice belongs to another context or is not positional",
          );
        if (!finitePoint(update.position) || !Number.isFinite(update.gain))
          throw new Error("Invalid audio voice update");
        return voice;
      });
      updates.forEach((update, index) => {
        const voice = voices[index]!;
        position(voice.panner!, update.position);
        voice.gain.gain.value = update.gain;
      });
    },
    stop(id) {
      resources.get<unknown>(id, "audio-voice");
      resources.remove(id);
    },
    async startProcessor(id, bytes, channels) {
      if (channels < 1 || channels > 32)
        throw new Error("DSP channel count must be between 1 and 32");
      const context = getContext(id);
      if (context.state !== "running")
        throw new Error(
          "Resume the AudioContext before starting a DSP processor",
        );
      // compile consumes the bytes before yielding; the module is cloned, not its memory.
      const module = await WebAssembly.compile(
        bytes as Uint8Array<ArrayBuffer>,
      );
      const exports = WebAssembly.Module.exports(module);
      if (
        WebAssembly.Module.imports(module).length ||
        !exports.some((e) => e.name === "memory" && e.kind === "memory") ||
        !exports.some((e) => e.name === "process" && e.kind === "function")
      )
        throw new Error(
          "DSP must have no imports and export memory and process",
        );
      if (!worklets.has(context)) {
        const url = URL.createObjectURL(
          new Blob([processorSource], { type: "text/javascript" }),
        );
        worklets.set(
          context,
          context.audioWorklet
            .addModule(url)
            .finally(() => URL.revokeObjectURL(url)),
        );
      }
      await worklets.get(context);
      signal.throwIfAborted();
      const node = new AudioWorkletNode(context, "druid-dsp", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [channels],
        processorOptions: { module },
      });
      const stop = () => {
        node.port.postMessage("stop");
        node.disconnect();
        node.port.close();
      };
      const voice = resources.add("audio-voice", { stop }, stop);
      try {
        await new Promise<void>((resolve, reject) => {
          const abort = () => reject(signal.reason);
          signal.addEventListener("abort", abort, { once: true });
          node.port.onmessage = () => {
            signal.removeEventListener("abort", abort);
            resolve();
          };
          node.onprocessorerror = () => {
            signal.removeEventListener("abort", abort);
            reject(new Error("WASM audio processor failed to initialize"));
          };
          node.connect(context.destination);
        });
        return voice;
      } catch (error) {
        if (!signal.aborted) resources.remove(voice);
        throw error;
      }
    },
    close: (id) => resources.remove(id),
  };
}
