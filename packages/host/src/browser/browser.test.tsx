import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createBrowserInterop } from "./index";
import { Resources } from "./resources";
import {
  BrowserCanvas,
  BrowserSurfacesContext,
  BrowserVideo,
} from "./surfaces";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("has a separate typed interface for each API, with no platform tools", () => {
  const browser = createBrowserInterop(new AbortController().signal);
  expect(Object.keys(browser.imports).sort()).toEqual(
    ["animation", "audio", "canvas", "http", "video", "webgl", "webgpu"].map(
      (s) => `druid:openui/${s}`,
    ),
  );
});

it("fetches binary assets without credentials or the authenticated resource loader", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(new Uint8Array([0, 255, 128])));
  vi.stubGlobal("fetch", fetcher);
  const api = createBrowserInterop(controller.signal).imports[
    "druid:openui/http"
  ];
  expect(
    await api.request({
      url: "https://assets.test/characters.tar",
      method: "GET",
      headers: [],
    }),
  ).toMatchObject({
    status: 200,
    body: new Uint8Array([0, 255, 128]),
  });
  expect(fetcher).toHaveBeenCalledWith("https://assets.test/characters.tar", {
    signal: controller.signal,
    credentials: "omit",
    mode: "cors",
    method: "GET",
    headers: [],
    body: undefined,
  });
  fetcher.mockResolvedValueOnce(new Response("not an asset", { status: 404 }));
  await expect(
    api.request({
      url: "https://assets.test/missing",
      method: "GET",
      headers: [],
    }),
  ).rejects.toBe("HTTP request failed (404)");
  controller.abort();
  expect(() =>
    api.request({
      url: "https://assets.test/characters.tar",
      method: "GET",
      headers: [],
    }),
  ).toThrow("abort");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("asks before every binary download, including retries, without remembering approval", async () => {
  const confirm = vi
    .fn()
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  const fetcher = vi.fn(() =>
    Promise.resolve(new Response(new Uint8Array([42]))),
  );
  vi.stubGlobal("confirm", confirm);
  vi.stubGlobal("fetch", fetcher);
  const api = createBrowserInterop(new AbortController().signal).imports[
    "druid:openui/http"
  ];
  const url = "https://assets.test/characters.tar";
  const request = { url, method: "GET", headers: [] };
  await expect(api.request(request)).resolves.toMatchObject({
    body: new Uint8Array([42]),
  });
  await expect(api.request(request)).rejects.toBe(
    "HTTP request denied by user",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(api.request(request)).resolves.toMatchObject({
    body: new Uint8Array([42]),
  });
  expect(confirm).toHaveBeenCalledTimes(3);
  expect(confirm.mock.calls.every(([message]) => message.includes(url))).toBe(
    true,
  );
  expect(confirm.mock.invocationCallOrder[0]).toBeLessThan(
    fetcher.mock.invocationCallOrder[0]!,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("never downloads or prompts for an unloaded guest", async () => {
  const controller = new AbortController();
  const confirm = vi.fn(() => {
    controller.abort();
    return true;
  });
  const fetcher = vi.fn();
  vi.stubGlobal("confirm", confirm);
  vi.stubGlobal("fetch", fetcher);
  const api = createBrowserInterop(controller.signal).imports[
    "druid:openui/http"
  ];
  await expect(
    api.request({
      url: "https://assets.test/characters.tar",
      method: "GET",
      headers: [],
    }),
  ).rejects.toContain("abort");
  expect(fetcher).not.toHaveBeenCalled();
  expect(() =>
    api.request({
      url: "https://assets.test/characters.tar",
      method: "GET",
      headers: [],
    }),
  ).toThrow("abort");
  expect(confirm).toHaveBeenCalledTimes(1);
});

it("shares the host confirmation and supports typed binary POST bodies and response metadata", async () => {
  const confirm = vi.fn().mockResolvedValue(undefined);
  const native = vi.fn();
  vi.stubGlobal("confirm", native);
  const fetcher = vi.fn().mockResolvedValue(
    new Response(new Uint8Array([255, 0]), {
      status: 201,
      headers: {
        "content-type": "application/octet-stream",
        "x-fixture": "yes",
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  const api = createBrowserInterop(signal, confirm).imports[
    "druid:openui/http"
  ];
  const request = {
    url: "https://assets.test/upload",
    method: "POST",
    headers: [["content-type", "application/octet-stream"]] as [
      string,
      string,
    ][],
    body: new Uint8Array([0, 128, 255]),
  };
  const result = await api.request(request);
  expect(confirm).toHaveBeenCalledWith(request.url);
  expect(native).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledWith(request.url, {
    method: "POST",
    headers: request.headers,
    body: request.body,
    signal,
    credentials: "omit",
    mode: "cors",
  });
  expect(result).toEqual({
    status: 201,
    headers: [
      ["content-type", "application/octet-stream"],
      ["x-fixture", "yes"],
    ],
    body: new Uint8Array([255, 0]),
  });
  confirm.mockRejectedValueOnce(new Error("cancelled"));
  await expect(api.request(request)).rejects.toBe("cancelled");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(api.request({ ...request, url: "file:///secret" })).rejects.toBe(
    "Use an HTTP(S) URL",
  );
  expect(confirm).toHaveBeenCalledTimes(2);
});

it("does not send a body for GET or HEAD and cancels while approval is pending", async () => {
  const controller = new AbortController();
  const confirm = vi.fn().mockResolvedValue(undefined);
  const fetcher = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response(null)));
  vi.stubGlobal("fetch", fetcher);
  const api = createBrowserInterop(controller.signal, confirm).imports[
    "druid:openui/http"
  ];
  for (const method of ["GET", "HEAD"]) {
    await api.request({
      url: "https://assets.test/",
      method,
      headers: [],
      body: new Uint8Array([1]),
    });
    expect(fetcher).toHaveBeenLastCalledWith(
      "https://assets.test/",
      expect.objectContaining({ body: undefined, method }),
    );
  }
  confirm.mockImplementationOnce(async () => {
    controller.abort();
  });
  await expect(
    api.request({ url: "https://assets.test/", method: "GET", headers: [] }),
  ).rejects.toContain("abort");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("batches canvas commands synchronously and passes binary buffers without JSON", () => {
  const context = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: "",
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([1, 2, 3, 4]) })),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as never,
  );
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const api = browser.imports["druid:openui/canvas"],
    id = api.open("a", 20, 10);
  api.draw(
    id,
    Array.from({ length: 1000 }, () => ({
      tag: "fill-rect" as const,
      val: { bounds: { x: 0, y: 0, width: 1, height: 1 }, color: "red" },
    })),
  );
  expect(context.fillRect).toHaveBeenCalledTimes(1000);
  expect(api.readPixels(id, 0, 0, 1, 1)).toEqual(new Uint8Array([1, 2, 3, 4]));
  expect(() => api.writePixels(id, new Uint8Array(3), 1, 1, 0, 0)).toThrow(
    "RGBA length",
  );
  controller.abort();
  expect(() => api.draw(id, [])).toThrow();
});

it("reports CSS metrics and DPR without changing backing resolution or acquiring a context", () => {
  const controller = new AbortController();
  const browser = createBrowserInterop(controller.signal);
  const api = browser.imports["druid:openui/canvas"];
  const handle = api.open("metrics", 960, 640);
  const element = browser.surfaces.getCanvas(handle);
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ width: 720, height: 480 } as DOMRect);
  vi.stubGlobal("devicePixelRatio", 2);
  const getContext = vi.spyOn(element, "getContext");
  expect(api.getMetrics(handle)).toEqual({ cssWidth: 720, cssHeight: 480, pixelRatio: 2, backingWidth: 960, backingHeight: 640 });
  expect(getContext).not.toHaveBeenCalled();
  expect(element.width).toBe(960);
  api.resize(handle, 1440, 960);
  expect(api.getMetrics(handle)).toMatchObject({ cssWidth: 720, backingWidth: 1440, backingHeight: 960 });
  expect(() => api.getMetrics(999999)).toThrow("Invalid canvas handle");
  controller.abort();
});

it("keeps surface IDs instance-local and mounts a surface created during guest init", () => {
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const api = browser.imports["druid:openui/canvas"],
    handle = api.open("view", 10, 20);
  const element = browser.surfaces.getCanvas(handle);
  const another = createBrowserInterop(new AbortController().signal);
  expect(() => another.surfaces.getCanvas(handle)).toThrow(
    "Invalid canvas handle",
  );
  const { unmount } = render(
    <BrowserSurfacesContext.Provider value={browser.surfaces}>
      <BrowserCanvas id="view" label="Plot" />
    </BrowserSurfacesContext.Provider>,
  );
  expect(screen.getByLabelText("Plot", { selector: "canvas" })).toBe(element);
  expect(element.width).toBe(10);
  unmount();
  controller.abort();
  expect(element.width).toBe(0);
});

it("renders inert surfaces outside a running host", () => {
  render(
    <>
      <BrowserCanvas id="a" />
      <BrowserVideo id="v" />
    </>,
  );
  expect(
    screen.getByText("Canvas unavailable in this preview"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Video unavailable in this preview"),
  ).toBeInTheDocument();
});

it("releases handles once in reverse order and releases late async creations", () => {
  const controller = new AbortController(),
    resources = new Resources(controller.signal),
    releases: number[] = [];
  resources.add("x", {}, () => releases.push(1));
  resources.add("x", {}, () => releases.push(2));
  controller.abort();
  expect(releases).toEqual([2, 1]);
  expect(() => resources.add("x", {}, () => releases.push(3))).toThrow();
  expect(releases).toEqual([2, 1, 3]);
});

it("cancels pending animation frames on guest replacement", async () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 42),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const promise = browser.imports["druid:openui/animation"].nextFrame();
  controller.abort();
  await expect(promise).rejects.toContain("abort");
  expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
});

it("reports unsupported APIs as WIT string errors instead of failing host creation", async () => {
  const browser = createBrowserInterop(new AbortController().signal);
  const gpu = browser.imports["druid:openui/webgpu"];
  expect(gpu.available()).toBe(false);
  await expect(gpu.requestDevice()).rejects.toContain("adapter unavailable");
});

it("does not allow executable URLs for video", () => {
  const api = createBrowserInterop(new AbortController().signal).imports[
    "druid:openui/video"
  ];
  expect(() => api.open("x", "javascript:alert(1)", true, false)).toThrow(
    "HTTP(S)",
  );
});

it("does not replace an active video by reopening its surface", () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const api = browser.imports["druid:openui/video"];
  const first = api.open(
    "player",
    "https://example.test/first.webm",
    true,
    false,
  );
  expect(() =>
    api.open("player", "https://example.test/second.webm", true, false),
  ).toThrow("already open");
  expect(browser.surfaces.video("player").src).toBe(
    "https://example.test/first.webm",
  );
  api.close(first);
  expect(
    api.open("player", "https://example.test/second.webm", true, false),
  ).not.toBe(first);
  controller.abort();
});

it("uploads PCM as floats, schedules on the audio clock and releases completed voices", () => {
  const source = {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: undefined as undefined | (() => void),
  };
  const gain = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  source.connect.mockReturnValue(gain);
  const buffer = { length: 64, copyToChannel: vi.fn() };
  const context = {
    createBuffer: () => buffer,
    createBufferSource: () => source,
    createGain: () => gain,
    currentTime: 12.5,
    close: vi.fn(async () => {}),
  };
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return context;
    }),
  );
  const controller = new AbortController(),
    api = createBrowserInterop(controller.signal).imports["druid:openui/audio"];
  const ctx = api.open(undefined),
    id = api.createBuffer(ctx, 1, 64, 48000);
  const samples = new Float32Array(64);
  api.writeChannel(id, 0, samples, 0);
  expect(buffer.copyToChannel).toHaveBeenCalledWith(samples, 0, 0);
  expect(buffer.copyToChannel.mock.calls[0]![0]).toBe(samples);
  const voice = api.play(ctx, id, api.time(ctx) + 1, 0.5, false);
  expect(source.start).toHaveBeenCalledWith(13.5);
  expect(gain.gain.value).toBe(0.5);
  source.onended!();
  expect(() => api.stop(voice)).toThrow("Invalid");
  controller.abort();
  expect(context.close).toHaveBeenCalledOnce();
  expect(source.disconnect).toHaveBeenCalledOnce();
});

it("cleans up failed audio scheduling instead of retaining an unusable voice", () => {
  const source = {
    connect: vi.fn(),
    start: vi.fn(() => {
      throw new Error("invalid time");
    }),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };
  const gain = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  source.connect.mockReturnValue(gain);
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return {
        createBuffer: () => ({}),
        createBufferSource: () => source,
        createGain: () => gain,
        close: async () => {},
      };
    }),
  );
  const controller = new AbortController(),
    api = createBrowserInterop(controller.signal).imports["druid:openui/audio"];
  const ctx = api.open(undefined),
    buffer = api.createBuffer(ctx, 1, 64, 48000);
  expect(() => api.play(ctx, buffer, -1, 1, false)).toThrow("invalid time");
  expect(source.disconnect).toHaveBeenCalledOnce();
  controller.abort();
  expect(source.disconnect).toHaveBeenCalledOnce();
});

it("rejects invalid DSP modules before registering a worklet", async () => {
  const addModule = vi.fn();
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return {
        state: "running",
        audioWorklet: { addModule },
        close: async () => {},
      };
    }),
  );
  const controller = new AbortController(),
    api = createBrowserInterop(controller.signal).imports["druid:openui/audio"];
  const ctx = api.open(undefined);
  await expect(
    api.startProcessor(ctx, new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]), 1),
  ).rejects.toContain("export memory and process");
  expect(addModule).not.toHaveBeenCalled();
  controller.abort();
});

it("closes each decoded VideoFrame even if drawing fails", async () => {
  let output!: (frame: { close: () => void }) => void;
  const close = vi.fn(),
    drawImage = vi.fn(() => {
      throw new Error("draw failed");
    });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as never);
  vi.stubGlobal(
    "VideoDecoder",
    class {
      static isConfigSupported = async () => ({ supported: true });
      state = "configured";
      constructor(config: { output: typeof output }) {
        output = config.output;
      }
      configure() {}
      close() {
        close();
      }
    },
  );
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const surface = browser.imports["druid:openui/canvas"].open("v", 10, 10);
  await browser.imports["druid:openui/video"].createDecoder(
    surface,
    "vp8",
    10,
    10,
    new Uint8Array(),
  );
  const frame = { close: vi.fn() };
  expect(() => output(frame)).toThrow("draw failed");
  expect(frame.close).toHaveBeenCalledOnce();
  controller.abort();
  expect(close).toHaveBeenCalledOnce();
});

it("reuses GPU objects and sends uploads as typed binary views", async () => {
  const writeBuffer = vi.fn(),
    destroy = vi.fn();
  const device = {
    createBuffer: vi.fn(({ size, usage }) => ({ size, usage, destroy })),
    limits: { maxBufferSize: 65536 },
    queue: { writeBuffer },
    destroy: vi.fn(),
    lost: new Promise(() => {}),
  };
  vi.stubGlobal("navigator", {
    gpu: {
      requestAdapter: async () => ({ requestDevice: async () => device }),
    },
  });
  vi.stubGlobal("GPUBufferUsage", { COPY_DST: 8 });
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal),
    gpu = browser.imports["druid:openui/webgpu"];
  const id = await gpu.requestDevice(undefined),
    buffer = gpu.createBuffer(id, 16, 8),
    bytes = new Uint8Array(16);
  for (let i = 0; i < 100; i++) gpu.writeBuffer(buffer, 0, bytes);
  expect(device.createBuffer).toHaveBeenCalledOnce();
  expect(writeBuffer).toHaveBeenLastCalledWith(expect.anything(), 0, bytes);
  expect(writeBuffer.mock.calls[0]![2]).toBe(bytes);
  expect(() => gpu.writeBuffer(buffer, 2, bytes)).toThrow("range");
  controller.abort();
  expect(destroy).toHaveBeenCalledOnce();
  expect(device.destroy).toHaveBeenCalledOnce();
});

it("releases failed WebGL shader allocations and returns the compiler error", () => {
  const gl = {
    isContextLost: () => false,
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    createProgram: () => ({}),
    createShader: () => ({}),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: () => false,
    getShaderInfoLog: () => "shader syntax error",
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    getExtension: () => null,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    gl as never,
  );
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const surface = browser.imports["druid:openui/canvas"].open("gl", 10, 10),
    api = browser.imports["druid:openui/webgl"];
  const context = api.open(surface);
  expect(() => api.createProgram(context, "invalid", "invalid")).toThrow(
    "shader syntax error",
  );
  expect(gl.deleteShader).toHaveBeenCalledOnce();
  expect(gl.deleteProgram).toHaveBeenCalledOnce();
  controller.abort();
});

it("opts into WebGL depth testing and clears depth between 3D frames", () => {
  const gl = {
    isContextLost: () => false,
    DEPTH_TEST: 2929,
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,
    drawingBufferWidth: 960,
    drawingBufferHeight: 640,
    enable: vi.fn(),
    disable: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    viewport: vi.fn(),
    useProgram: vi.fn(),
    drawArrays: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    uniformMatrix4fv: vi.fn(),
    createProgram: () => ({}),
    createShader: () => ({}),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    getExtension: () => null,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    gl as never,
  );
  const controller = new AbortController(),
    browser = createBrowserInterop(controller.signal);
  const api = browser.imports["druid:openui/webgl"];
  const context = api.open(
    browser.imports["druid:openui/canvas"].open("3d", 960, 640),
  );
  api.depthTest(context, true);
  expect(gl.enable).toHaveBeenCalledWith(gl.DEPTH_TEST);
  const program = api.createProgram(context, "vertex", "fragment");
  const bones = Array.from({ length: 24 * 16 }, (_, i) =>
    i % 5 === 0 ? 1 : 0,
  );
  api.draw(
    context,
    program,
    [],
    [{ name: "bones[0]", values: bones }],
    4,
    0,
    36,
    undefined,
  );
  expect(gl.uniformMatrix4fv).toHaveBeenCalledWith(
    expect.anything(),
    false,
    bones,
  );
  expect(() =>
    api.draw(
      context,
      program,
      [],
      [{ name: "bones[0]", values: [1, 2, 3, 4, 5] }],
      4,
      0,
      36,
      undefined,
    ),
  ).toThrow("complete mat4");
  api.draw(context, program, [], [], 4, 0, 36, [0, 0, 0, 1]);
  expect(gl.clear).toHaveBeenCalledWith(
    gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
  );
  api.depthTest(context, false);
  expect(gl.disable).toHaveBeenCalledWith(gl.DEPTH_TEST);
  controller.abort();
});

it("destroys GPU staging buffers after failed readback", async () => {
  const buffer = { usage: 4, destroy: vi.fn() };
  const staging = {
    mapAsync: vi.fn(async () => {
      throw new Error("map failed");
    }),
    destroy: vi.fn(),
  };
  const device = {
    createBuffer: vi
      .fn()
      .mockReturnValueOnce(buffer)
      .mockReturnValueOnce(staging),
    limits: { maxBufferSize: 65536 },
    createCommandEncoder: () => ({
      copyBufferToBuffer: vi.fn(),
      finish: () => ({}),
    }),
    queue: { submit: vi.fn() },
    destroy: vi.fn(),
    lost: new Promise(() => {}),
  };
  vi.stubGlobal("navigator", {
    gpu: {
      requestAdapter: async () => ({ requestDevice: async () => device }),
    },
  });
  vi.stubGlobal("GPUBufferUsage", { COPY_SRC: 4, COPY_DST: 8, MAP_READ: 1 });
  vi.stubGlobal("GPUMapMode", { READ: 1 });
  const controller = new AbortController(),
    api = createBrowserInterop(controller.signal).imports[
      "druid:openui/webgpu"
    ];
  const dev = await api.requestDevice(undefined),
    id = api.createBuffer(dev, 16, 4);
  await expect(api.readBuffer(id, 0, 16)).rejects.toContain("map failed");
  expect(staging.destroy).toHaveBeenCalledOnce();
  controller.abort();
  expect(buffer.destroy).toHaveBeenCalledOnce();
});
