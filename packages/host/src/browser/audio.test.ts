import { afterEach, expect, it, vi } from "vitest";
import { audio } from "./audio";
import { Resources } from "./resources";

afterEach(() => vi.unstubAllGlobals());
const param = () => ({ value: 0 });
const point = (x = 0, y = 0, z = 0) => ({ x, y, z });
const spatial = (x = 0) => ({
  position: point(x),
  refDistance: 1,
  maxDistance: 40,
  rolloff: 1,
});

function setup() {
  const contexts: ReturnType<typeof makeContext>[] = [];
  function makeContext() {
    const sources: ReturnType<typeof makeSource>[] = [];
    const gains: ReturnType<typeof makeGain>[] = [];
    const panners: ReturnType<typeof makePanner>[] = [];
    function makeSource() {
      return {
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as null | (() => void),
      };
    }
    function makeGain() {
      return { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
    }
    function makePanner() {
      return {
        positionX: param(),
        positionY: param(),
        positionZ: param(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
    return {
      currentTime: 2,
      destination: {},
      listener: {
        positionX: param(),
        positionY: param(),
        positionZ: param(),
        forwardX: param(),
        forwardY: param(),
        forwardZ: param(),
        upX: param(),
        upY: param(),
        upZ: param(),
      },
      sources,
      gains,
      panners,
      createBuffer: vi.fn(() => ({ length: 64, copyToChannel: vi.fn() })),
      createBufferSource: vi.fn(() => {
        const source = makeSource();
        sources.push(source);
        return source;
      }),
      createGain: vi.fn(() => {
        const gain = makeGain();
        gains.push(gain);
        return gain;
      }),
      createPanner: vi.fn(() => {
        const panner = makePanner();
        panners.push(panner);
        return panner;
      }),
      resume: vi.fn(async () => {}),
      suspend: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
  }
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      const context = makeContext();
      contexts.push(context);
      return context;
    }),
  );
  const controller = new AbortController();
  const api = audio(new Resources(controller.signal), controller.signal);
  const context = api.open(undefined);
  const buffer = api.createBuffer(context, 1, 64, 48000);
  return { api, controller, contexts, context, buffer };
}

it("sets the listener and schedules positional audio without copying PCM", () => {
  const { api, controller, contexts, context, buffer } = setup();
  api.setListener(context, {
    position: point(1, 2, 3),
    forward: point(0, 0, -1),
    up: point(0, 1, 0),
  });
  const voice = api.playAt(context, buffer, 2.1, 0.4, false, spatial(7));
  const ctx = contexts[0]!;
  expect(ctx.listener.positionX.value).toBe(1);
  expect(ctx.listener.forwardZ.value).toBe(-1);
  expect(ctx.sources[0]!.start).toHaveBeenCalledWith(2.1);
  expect(ctx.panners[0]!.positionX.value).toBe(7);
  expect(ctx.gains[0]!.gain.value).toBe(0.4);
  api.updateVoices(context, [{ voice, position: point(-3, 1, 9), gain: 0.2 }]);
  expect(ctx.panners[0]!.positionZ.value).toBe(9);
  expect(ctx.gains[0]!.gain.value).toBe(0.2);
  controller.abort();
  expect(ctx.sources[0]!.stop).toHaveBeenCalledOnce();
  expect(ctx.panners[0]!.disconnect).toHaveBeenCalledOnce();
});

it("pools gain and panner nodes but creates a fresh single-use source", () => {
  const { api, controller, contexts, context, buffer } = setup();
  const voice = api.playAt(context, buffer, 2, 0.4, false, spatial(1));
  const ctx = contexts[0]!;
  ctx.sources[0]!.onended!();
  expect(() => api.stop(voice)).toThrow("Invalid");
  api.playAt(context, buffer, 2.1, 0.8, false, spatial(8));
  expect(ctx.createGain).toHaveBeenCalledTimes(1);
  expect(ctx.createPanner).toHaveBeenCalledTimes(1);
  expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);
  expect(ctx.panners[0]!.positionX.value).toBe(8);
  expect(ctx.gains[0]!.gain.value).toBe(0.8);
  controller.abort();
});

it("checks context ownership and validates a whole batch before changing voices", () => {
  const { api, controller, contexts, context, buffer } = setup();
  const first = api.playAt(context, buffer, 2, 0.4, false, spatial(1));
  const other = api.open(undefined);
  const otherBuffer = api.createBuffer(other, 1, 64, 48000);
  const second = api.playAt(other, otherBuffer, 2, 0.5, false, spatial(2));
  expect(() => api.playAt(other, buffer, 2, 1, false, spatial())).toThrow(
    "another context",
  );
  expect(() =>
    api.updateVoices(context, [
      { voice: first, position: point(8), gain: 1 },
      { voice: second, position: point(9), gain: 1 },
    ]),
  ).toThrow("another context");
  expect(contexts[0]!.panners[0]!.positionX.value).toBe(1);
  expect(() =>
    api.updateVoices(context, [
      { voice: first, position: point(NaN), gain: 1 },
    ]),
  ).toThrow("Invalid");
  expect(() =>
    api.playAt(context, buffer, 2, 1, false, { ...spatial(), refDistance: 0 }),
  ).toThrow("Invalid");
  api.close(other);
  expect(contexts[1]!.sources[0]!.stop).toHaveBeenCalledOnce();
  controller.abort();
});

it("bounds active voices and releases a slot on completion", () => {
  const { api, controller, contexts, context, buffer } = setup();
  for (let i = 0; i < 64; i++)
    api.playAt(context, buffer, 2, 1, false, spatial());
  expect(() => api.playAt(context, buffer, 2, 1, false, spatial())).toThrow(
    "64 active",
  );
  contexts[0]!.sources[0]!.onended!();
  expect(() =>
    api.playAt(context, buffer, 2, 1, false, spatial()),
  ).not.toThrow();
  controller.abort();
});

it("leaves autoplay decisions to resume and suspend rather than auto-starting", async () => {
  const { api, controller, contexts, context } = setup();
  expect(contexts[0]!.resume).not.toHaveBeenCalled();
  await api.resume(context);
  await api.suspend(context);
  expect(contexts[0]!.resume).toHaveBeenCalledOnce();
  expect(contexts[0]!.suspend).toHaveBeenCalledOnce();
  controller.abort();
});
