import { afterEach, describe, expect, it, vi } from "vitest";
import type * as W from "druid:openui/webgpu";
import { Resources } from "./resources";
import { Surfaces } from "./surfaces";
import { webgpu } from "./webgpu";

afterEach(() => vi.unstubAllGlobals());
function mockDevice() {
  const passes: ReturnType<typeof pass>[] = [];
  function pass() {
    return {
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      setVertexBuffer: vi.fn(),
      setIndexBuffer: vi.fn(),
      setViewport: vi.fn(),
      setScissorRect: vi.fn(),
      setBlendConstant: vi.fn(),
      draw: vi.fn(),
      drawIndexed: vi.fn(),
      drawIndirect: vi.fn(),
      drawIndexedIndirect: vi.fn(),
      dispatchWorkgroups: vi.fn(),
      dispatchWorkgroupsIndirect: vi.fn(),
      end: vi.fn(),
    };
  }
  const encoder = {
    beginRenderPass: vi.fn(() => {
      const p = pass();
      passes.push(p);
      return p;
    }),
    beginComputePass: vi.fn(() => {
      const p = pass();
      passes.push(p);
      return p;
    }),
    copyBufferToBuffer: vi.fn(),
    copyTextureToTexture: vi.fn(),
    resolveQuerySet: vi.fn(),
    finish: vi.fn(() => ({})),
  };
  let lose!: (info: { message: string }) => void;
  const device = {
    limits: {
      maxBufferSize: 1024 * 1024,
      maxTextureDimension1D: 8192,
      maxTextureDimension2D: 8192,
      maxTextureDimension3D: 2048,
      maxTextureArrayLayers: 256,
      minUniformBufferOffsetAlignment: 256,
      minStorageBufferOffsetAlignment: 128,
      maxUniformBufferBindingSize: 65536,
      maxStorageBufferBindingSize: 1024 * 1024,
      maxBindGroups: 4,
      maxVertexBuffers: 8,
      maxComputeWorkgroupsPerDimension: 65535,
    },
    features: new Set(["timestamp-query"]),
    lost: new Promise<{ message: string }>((resolve) => {
      lose = resolve;
    }),
    addEventListener: vi.fn(),
    destroy: vi.fn(),
    queue: {
      writeBuffer: vi.fn(),
      writeTexture: vi.fn(),
      submit: vi.fn(),
      onSubmittedWorkDone: vi.fn(async () => {}),
    },
    createBuffer: vi.fn((descriptor: GPUBufferDescriptor) => ({
      ...descriptor,
      destroy: vi.fn(),
    })),
    createTexture: vi.fn((descriptor: GPUTextureDescriptor) => ({
      ...descriptor,
      destroy: vi.fn(),
      createView: vi.fn(() => ({})),
    })),
    createSampler: vi.fn(() => ({})),
    createShaderModule: vi.fn(() => ({
      getCompilationInfo: vi.fn(async () => ({ messages: [] })),
    })),
    createBindGroupLayout: vi.fn(() => ({})),
    createBindGroup: vi.fn(() => ({})),
    createPipelineLayout: vi.fn(() => ({})),
    createRenderPipelineAsync: vi.fn(async () => ({})),
    createComputePipelineAsync: vi.fn(async () => ({})),
    createQuerySet: vi.fn(() => ({ destroy: vi.fn() })),
    createCommandEncoder: vi.fn(() => encoder),
  };
  return { device, encoder, passes, lose };
}
async function setup(
  features: W.DeviceFeature[] = [],
  available: W.DeviceFeature[] = ["timestamp-query"],
) {
  const mock = mockDevice(),
    adapter = {
      features: new Set(available),
      requestDevice: vi.fn(async () => mock.device),
    };
  vi.stubGlobal("navigator", {
    gpu: {
      requestAdapter: vi.fn(async () => adapter),
      getPreferredCanvasFormat: () => "bgra8unorm",
    },
  });
  const controller = new AbortController(),
    resources = new Resources(controller.signal),
    surfaces = new Surfaces(resources),
    api = webgpu(surfaces, resources);
  const id = await api.requestDevice({ features });
  return { ...mock, adapter, controller, resources, surfaces, api, id };
}
const viewDescriptor: W.ViewDescriptor = {
  dimension: "d2",
  aspect: "all",
  baseMipLevel: 0,
  baseArrayLayer: 0,
};
function tex(
  api: ReturnType<typeof webgpu>,
  id: number,
  format: W.TextureFormat = "rgba8unorm",
  usage = 16 | 4 | 2 | 1,
) {
  const texture = api.createTexture(id, {
    size: { width: 64, height: 64, depthOrArrayLayers: 1 },
    dimension: "d2",
    format,
    mipLevelCount: 1,
    sampleCount: 1,
    usage,
  });
  return { texture, view: api.createTextureView(texture, viewDescriptor) };
}
const primitive: W.PrimitiveState = {
  topology: "triangle-list",
  front: "ccw",
  cull: "back",
};
async function renderPipeline(
  api: ReturnType<typeof webgpu>,
  id: number,
  layouts = new Uint32Array(),
  depth = false,
) {
  const shader = await api.createShader(
    id,
    "@vertex fn vs() -> @builtin(position) vec4f { return vec4f(0); }",
  );
  return api.createRenderPipeline(id, {
    vertex: { shader, entry: "vs" },
    fragment: depth ? undefined : { shader, entry: "fs" },
    layouts,
    vertexBuffers: [],
    primitive,
    depth: depth
      ? {
          format: "depth32float",
          write: true,
          compare: "less",
          bias: 2,
          biasSlopeScale: 1.5,
          biasClamp: 0,
        }
      : undefined,
    colors: depth ? [] : [{ format: "rgba8unorm", writeMask: 15 }],
    sampleCount: 1,
    alphaToCoverage: false,
  });
}
function colorPass(
  view: number,
  load: W.LoadOp = "clear",
): W.RenderPassDescriptor {
  return {
    colors: [
      {
        target: { tag: "view", val: view },
        load,
        store: "store",
        clear: { r: 0, g: 0, b: 0, a: 1 },
      },
    ],
  };
}
const draw: W.RenderCommand = {
  tag: "draw",
  val: { vertices: 3, instances: 10, firstVertex: 0, firstInstance: 0 },
};

describe("native WebGPU frame interface", () => {
  it("uploads R8 masks as one byte per texel with uncompressed odd-size mips", async () => {
    const { api, id, device, controller } = await setup();
    const texture = api.createTexture(id, {
      size: { width: 7, height: 5, depthOrArrayLayers: 2 },
      dimension: "d2",
      format: "r8unorm",
      mipLevelCount: 3,
      sampleCount: 1,
      usage: 2 | 4,
    });
    const destination = { texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } };
    const size = { width: 7, height: 5, depthOrArrayLayers: 2 };
    const bytes = new Uint8Array(70);
    api.writeTexture(destination, size, bytes, 7, 5);
    expect(device.createTexture.mock.calls[0]![0].format).toBe("r8unorm");
    expect(device.queue.writeTexture.mock.calls[0]![1]).toBe(bytes);
    expect(device.queue.writeTexture.mock.calls[0]![2]).toEqual({
      bytesPerRow: 7,
      rowsPerImage: 5,
    });
    expect(() =>
      api.writeTexture(destination, size, bytes.subarray(0, 69), 7, 5),
    ).toThrow("layout/data");
    expect(() => api.writeTexture(destination, size, bytes, 6, 5)).toThrow(
      "layout/data",
    );
    const tail = new Uint8Array([255]);
    api.writeTexture(
      { texture, mipLevel: 2, origin: { x: 0, y: 0, z: 1 } },
      { width: 1, height: 1, depthOrArrayLayers: 1 },
      tail,
      1,
      1,
    );
    expect(device.queue.writeTexture.mock.calls[1]![1]).toBe(tail);
    expect(device.queue.writeTexture).toHaveBeenCalledTimes(2);
    controller.abort();
  });
  const compressedDescriptor = (
    format: W.TextureFormat,
  ): W.TextureDescriptor => ({
    size: { width: 16, height: 12, depthOrArrayLayers: 3 },
    dimension: "d2",
    format,
    mipLevelCount: 5,
    sampleCount: 1,
    usage: 1 | 2 | 4,
  });
  const compressedFormats: [W.TextureFormat, W.DeviceFeature][] = [
    ["astc-4x4-unorm", "texture-compression-astc"],
    ["astc-4x4-unorm-srgb", "texture-compression-astc"],
    ["bc7-rgba-unorm", "texture-compression-bc"],
    ["bc7-rgba-unorm-srgb", "texture-compression-bc"],
  ];
  it.each(compressedFormats)(
    "uploads physical blocks for %s including odd mips and final1x1",
    async (format, feature) => {
      const { api, id, device, controller } = await setup([feature], [feature]);
      const texture = api.createTexture(id, compressedDescriptor(format));
      // Logical mip1=8x6, physical blocks=8x8. Two layers use block-row strides.
      const destination = {
        texture,
        mipLevel: 1,
        origin: { x: 0, y: 0, z: 1 },
      };
      const size = { width: 8, height: 8, depthOrArrayLayers: 2 };
      const bytes = new Uint8Array(160);
      api.writeTexture(destination, size, bytes, 32, 3);
      expect(device.queue.writeTexture.mock.calls[0]![1]).toBe(bytes);
      expect(device.queue.writeTexture.mock.calls[0]![2]).toEqual({
        bytesPerRow: 32,
        rowsPerImage: 3,
      });
      expect(device.queue.writeTexture.mock.calls[0]![3]).toEqual(size);
      expect(() =>
        api.writeTexture(destination, size, bytes.subarray(0, 159), 32, 3),
      ).toThrow("layout/data");
      // Logical mip4=1x1 still occupies one complete4x4 block, not16 texels/rows.
      api.writeTexture(
        { texture, mipLevel: 4, origin: { x: 0, y: 0, z: 2 } },
        { width: 4, height: 4, depthOrArrayLayers: 1 },
        new Uint8Array(16),
        16,
        1,
      );
      expect(device.queue.writeTexture).toHaveBeenCalledTimes(2);
      expect(api.getDeviceInfo(id).features).toContain(feature);
      expect(device.createTexture.mock.calls[0]![0].format).toBe(format);
      controller.abort();
    },
  );
  it("rejects unenabled compression before native allocation", async () => {
    const { api, id, device, controller } = await setup(
      [],
      ["texture-compression-astc"],
    );
    expect(() =>
      api.createTexture(id, compressedDescriptor("astc-4x4-unorm")),
    ).toThrow("requires enabled");
    expect(() =>
      api.createTexture(id, compressedDescriptor("bc7-rgba-unorm")),
    ).toThrow("requires enabled");
    expect(device.createTexture).not.toHaveBeenCalled();
    controller.abort();
  });
  it("checks compressed creation and block-aligned copy origins/extents/rows", async () => {
    const { api, id, device, controller } = await setup(
      ["texture-compression-bc"],
      ["texture-compression-bc"],
    );
    const descriptor = compressedDescriptor("bc7-rgba-unorm");
    for (const invalid of [
      { ...descriptor, dimension: "d3" as const },
      { ...descriptor, sampleCount: 4 },
      { ...descriptor, usage: 16 | 4 },
      { ...descriptor, usage: 8 | 4 },
      { ...descriptor, size: { ...descriptor.size, width: 15 } },
    ])
      expect(() => api.createTexture(id, invalid)).toThrow(
        "Compressed textures",
      );
    const texture = api.createTexture(id, descriptor);
    const copy = { texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } };
    const size = { width: 8, height: 8, depthOrArrayLayers: 1 };
    const bytes = new Uint8Array(64);
    expect(() =>
      api.writeTexture(
        { ...copy, origin: { x: 2, y: 0, z: 0 } },
        size,
        bytes,
        32,
        2,
      ),
    ).toThrow("block aligned");
    expect(() =>
      api.writeTexture(copy, { ...size, width: 6 }, bytes, 32, 2),
    ).toThrow("block aligned");
    expect(() => api.writeTexture(copy, size, bytes, 33, 2)).toThrow(
      "layout/data",
    );
    expect(() => api.writeTexture(copy, size, bytes, 32, 1)).toThrow(
      "layout/data",
    );
    expect(() =>
      api.writeTexture({ ...copy, mipLevel: 4 }, size, bytes, 32, 2),
    ).toThrow("out of bounds");
    expect(device.queue.writeTexture).not.toHaveBeenCalled();
    controller.abort();
  });
  it("copies compatible compressed formats and rejects incompatible/depth partial copies", async () => {
    const { api, id, encoder, controller } = await setup(
      ["texture-compression-bc", "texture-compression-astc"],
      ["texture-compression-bc", "texture-compression-astc"],
    );
    const copy = (format: W.TextureFormat) => ({
      texture: api.createTexture(id, compressedDescriptor(format)),
      mipLevel: 4,
      origin: { x: 0, y: 0, z: 0 },
    });
    const source = copy("bc7-rgba-unorm"),
      destination = copy("bc7-rgba-unorm-srgb");
    api.copyTexture(api.beginFrame(id), source, destination, {
      width: 4,
      height: 4,
      depthOrArrayLayers: 1,
    });
    expect(encoder.copyTextureToTexture).toHaveBeenCalledOnce();
    expect(() =>
      api.copyTexture(api.beginFrame(id), source, copy("astc-4x4-unorm"), {
        width: 4,
        height: 4,
        depthOrArrayLayers: 1,
      }),
    ).toThrow("not compatible");
    const depth = tex(api, id, "depth32float");
    const depthCopy = {
      texture: depth.texture,
      mipLevel: 0,
      origin: { x: 0, y: 0, z: 0 },
    };
    expect(() =>
      api.writeTexture(
        depthCopy,
        { width: 64, height: 64, depthOrArrayLayers: 1 },
        new Uint8Array(16384),
        256,
        64,
      ),
    ).toThrow("Depth textures");
    expect(() =>
      api.copyTexture(api.beginFrame(id), depthCopy, depthCopy, {
        width: 32,
        height: 64,
        depthOrArrayLayers: 1,
      }),
    ).toThrow("full subresource");
    controller.abort();
  });
  it("destroy(device) recursively removes partial-construction handles exactly once", async () => {
    const { api, id, device, controller } = await setup(["timestamp-query"]);
    const b = api.createBuffer(id, 256, 64),
      image = tex(api, id),
      frame = api.beginFrame(id),
      queries = api.createTimestampQuerySet(id, 2);
    const layout = api.createBindGroupLayout(id, [
      {
        binding: 0,
        visibility: 1,
        layout: {
          tag: "buffer",
          val: { kind: "uniform", dynamic: false, minBindingSize: 16 },
        },
      },
    ]);
    const group = api.createBindGroup(layout, [
      {
        binding: 0,
        resource: { tag: "buffer", val: { buffer: b, offset: 0, size: 64 } },
      },
    ]);
    api.destroy(id);
    for (const handle of [
      b,
      image.texture,
      image.view,
      frame,
      queries,
      layout,
      group,
    ])
      expect(() => api.destroy(handle)).toThrow("handle");
    expect(
      device.createBuffer.mock.results[0]!.value.destroy,
    ).toHaveBeenCalledOnce();
    expect(
      device.createTexture.mock.results[0]!.value.destroy,
    ).toHaveBeenCalledOnce();
    expect(
      device.createQuerySet.mock.results[0]!.value.destroy,
    ).toHaveBeenCalledOnce();
    expect(device.queue.submit).not.toHaveBeenCalled();
    controller.abort();
    expect(device.destroy).toHaveBeenCalledOnce();
  });
  it("enables only advertised optional features and reports real limits/loss", async () => {
    const { api, id, adapter, lose } = await setup([
      "timestamp-query",
      "shader-f16",
    ]);
    expect(adapter.requestDevice).toHaveBeenCalledWith({
      requiredFeatures: ["timestamp-query"],
    });
    expect(api.getDeviceInfo(id)).toMatchObject({
      features: ["timestamp-query"],
      minUniformBufferOffsetAlignment: 256,
      minStorageBufferOffsetAlignment: 128,
      preferredFormat: "bgra8unorm",
    });
    lose({ message: "simulated reset" });
    await Promise.resolve();
    expect(api.getDeviceState(id).lost).toContain("simulated reset");
    expect(() => api.beginFrame(id)).toThrow("lost");
  });
  it("keeps bulk buffer/texture uploads typed, persistent and subresource bounded", async () => {
    const { api, id, device } = await setup();
    const buffer = api.createBuffer(id, 256, 8 | 64),
      bytes = new Uint8Array(256);
    for (let i = 0; i < 20; i++) api.writeBuffer(buffer, 0, bytes);
    expect(device.createBuffer).toHaveBeenCalledOnce();
    expect(device.queue.writeBuffer.mock.calls[0]![2]).toBe(bytes);
    const t = tex(api, id),
      pixels = new Uint8Array(64 * 64 * 4);
    api.writeTexture(
      { texture: t.texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
      { width: 64, height: 64, depthOrArrayLayers: 1 },
      pixels,
      256,
      64,
    );
    expect(device.queue.writeTexture.mock.calls[0]![1]).toBe(pixels);
    expect(() =>
      api.writeTexture(
        { texture: t.texture, mipLevel: 1, origin: { x: 0, y: 0, z: 0 } },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
        pixels,
        4,
        1,
      ),
    ).toThrow("mip");
    expect(() => api.writeBuffer(buffer, 2, bytes)).toThrow("alignment");
  });
  it("encodes compute, depth-only shadow, opaque, alpha and post in one encoder/submit", async () => {
    const { api, id, device, encoder, passes } = await setup();
    const shader = await api.createShader(id, "WGSL native"),
      compute = await api.createComputePipeline(id, {
        stage: { shader, entry: "cs" },
        layouts: new Uint32Array(),
      });
    const shadow = await renderPipeline(api, id, new Uint32Array(), true),
      opaque = await renderPipeline(api, id),
      depth = tex(api, id, "depth32float"),
      color = tex(api, id);
    const frame = api.beginFrame(id);
    api.encodeComputePass(frame, {}, [
      { tag: "pipeline", val: compute },
      { tag: "dispatch", val: { x: 6, y: 6, z: 1 } },
    ]);
    api.encodeRenderPass(
      frame,
      {
        colors: [],
        depth: {
          view: depth.view,
          clear: 1,
          load: "clear",
          store: "store",
          readOnly: false,
        },
      },
      [{ tag: "pipeline", val: shadow }, draw],
    );
    for (const load of ["clear", "load", "load"] as const)
      api.encodeRenderPass(frame, colorPass(color.view, load), [
        { tag: "pipeline", val: opaque },
        draw,
      ]);
    expect(device.createCommandEncoder).toHaveBeenCalledOnce();
    expect(device.queue.submit).not.toHaveBeenCalled();
    expect(passes).toHaveLength(5);
    for (const p of passes) expect(p.end).toHaveBeenCalledOnce();
    api.submitFrame(frame);
    expect(encoder.finish).toHaveBeenCalledOnce();
    expect(device.queue.submit).toHaveBeenCalledOnce();
    expect(() => api.submitFrame(frame)).toThrow("handle");
    expect(() => api.encodeComputePass(frame, {}, [])).toThrow("handle");
    expect(device.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
    expect(device.createRenderPipelineAsync.mock.calls[0]![0]).toMatchObject({
      fragment: undefined,
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: true,
        depthBias: 2,
        depthBiasSlopeScale: 1.5,
      },
      primitive: { cullMode: "back" },
    });
  });
  it("uses explicit shared layouts and validates dynamic binding order/range/alignment", async () => {
    const { api, id, passes } = await setup(),
      b = api.createBuffer(id, 2048, 64 | 128 | 8);
    const layout = api.createBindGroupLayout(id, [
      {
        binding: 2,
        visibility: 1,
        layout: {
          tag: "buffer",
          val: { kind: "uniform", dynamic: true, minBindingSize: 64 },
        },
      },
      {
        binding: 0,
        visibility: 1,
        layout: {
          tag: "buffer",
          val: {
            kind: "read-only-storage",
            dynamic: true,
            minBindingSize: 128,
          },
        },
      },
    ]);
    const group = api.createBindGroup(
      layout,
      [2, 0].map((binding) => ({
        binding,
        resource: { tag: "buffer", val: { buffer: b, offset: 0, size: 256 } },
      })),
    );
    const pipeline = await renderPipeline(api, id, new Uint32Array([layout])),
      color = tex(api, id),
      frame = api.beginFrame(id);
    api.encodeRenderPass(frame, colorPass(color.view), [
      { tag: "pipeline", val: pipeline },
      {
        tag: "group",
        val: { index: 0, group, dynamicOffsets: new Uint32Array([128, 256]) },
      },
      draw,
    ]);
    expect(passes[0]!.setBindGroup.mock.calls[0]![2]).toEqual(
      new Uint32Array([128, 256]),
    );
    const bad = api.beginFrame(id);
    expect(() =>
      api.encodeRenderPass(bad, colorPass(color.view), [
        { tag: "pipeline", val: pipeline },
        {
          tag: "group",
          val: { index: 0, group, dynamicOffsets: new Uint32Array([1, 256]) },
        },
      ]),
    ).toThrow("alignment");
    expect(() => api.submitFrame(bad)).toThrow("invalid");
    api.destroy(bad);
    api.destroy(b);
    expect(() =>
      api.encodeRenderPass(frame, colorPass(color.view), [
        {
          tag: "group",
          val: { index: 0, group, dynamicOffsets: new Uint32Array([128, 256]) },
        },
      ]),
    ).toThrow("destroyed");
  });
  it("binds depth textures/comparison samplers and preserves vertex/instance/blend descriptors", async () => {
    const { api, id, device } = await setup();
    const depth = tex(api, id, "depth24plus"),
      sampler = api.createSampler(id, {
        addressU: "clamp-to-edge",
        addressV: "clamp-to-edge",
        addressW: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "nearest",
        lodMinClamp: 0,
        lodMaxClamp: 16,
        compare: "less-equal",
        maxAnisotropy: 1,
      });
    const layout = api.createBindGroupLayout(id, [
      {
        binding: 0,
        visibility: 2,
        layout: {
          tag: "texture",
          val: { sampleType: "depth", dimension: "d2", multisampled: false },
        },
      },
      {
        binding: 1,
        visibility: 2,
        layout: { tag: "sampler", val: "comparison" },
      },
    ]);
    api.createBindGroup(layout, [
      { binding: 0, resource: { tag: "texture-view", val: depth.view } },
      { binding: 1, resource: { tag: "sampler", val: sampler } },
    ]);
    expect(device.createSampler).toHaveBeenCalledWith(
      expect.objectContaining({ compare: "less-equal" }),
    );
    const shader = await api.createShader(id, "native WGSL");
    await api.createRenderPipeline(id, {
      vertex: { shader, entry: "vs" },
      fragment: { shader, entry: "fs" },
      layouts: new Uint32Array([layout]),
      vertexBuffers: [
        {
          stride: 12,
          step: "vertex",
          attributes: [{ format: "float32x3", offset: 0, location: 0 }],
        },
        {
          stride: 16,
          step: "instance",
          attributes: [{ format: "float32x4", offset: 0, location: 1 }],
        },
      ],
      primitive,
      colors: [
        {
          format: "rgba8unorm",
          writeMask: 15,
          blend: {
            color: {
              src: "src-alpha",
              dst: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: { src: "one", dst: "one-minus-src-alpha", operation: "add" },
          },
        },
      ],
      depth: {
        format: "depth24plus",
        write: false,
        compare: "less-equal",
        bias: 0,
        biasSlopeScale: 0,
        biasClamp: 0,
      },
      sampleCount: 4,
      alphaToCoverage: true,
    });
    expect(device.createRenderPipelineAsync.mock.calls[0]![0]).toMatchObject({
      vertex: {
        buffers: [
          { arrayStride: 12, stepMode: "vertex" },
          { arrayStride: 16, stepMode: "instance" },
        ],
      },
      fragment: {
        targets: [
          {
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
            },
          },
        ],
      },
      depthStencil: { depthWriteEnabled: false },
      multisample: { count: 4, alphaToCoverageEnabled: true },
    });
  });
  it("forwards indexed/instanced/indirect arguments without readback or per-draw allocation", async () => {
    const { api, id, device, passes } = await setup(),
      p = await renderPipeline(api, id),
      color = tex(api, id),
      b = api.createBuffer(id, 512, 16 | 32 | 256);
    const before = device.createBuffer.mock.calls.length,
      frame = api.beginFrame(id);
    api.encodeRenderPass(frame, colorPass(color.view), [
      { tag: "pipeline", val: p },
      {
        tag: "vertex-buffer",
        val: { slot: 0, buffer: b, offset: 0, size: 128 },
      },
      {
        tag: "index-buffer",
        val: { buffer: b, offset: 128, size: 128, format: "uint16" },
      },
      {
        tag: "draw-indexed",
        val: {
          indices: 6,
          instances: 12544,
          firstIndex: 3,
          baseVertex: -1,
          firstInstance: 4,
        },
      },
      { tag: "draw-indexed-indirect", val: { buffer: b, offset: 256 } },
    ]);
    expect(passes[0]!.drawIndexed).toHaveBeenCalledWith(6, 12544, 3, -1, 4);
    expect(passes[0]!.drawIndexedIndirect).toHaveBeenCalledWith(
      expect.anything(),
      256,
    );
    expect(device.createBuffer).toHaveBeenCalledTimes(before);
    expect(device.queue.submit).not.toHaveBeenCalled();
  });
  it("acquires the surface once per frame, rejects resize races and releases ownership", async () => {
    const { api, id, surfaces, controller } = await setup(),
      current = { createView: vi.fn(() => ({})) },
      context = {
        configure: vi.fn(),
        unconfigure: vi.fn(),
        getCurrentTexture: vi.fn(() => current),
      };
    const surface = surfaces.canvas("GPU", 64, 64);
    vi.spyOn(surfaces.getCanvas(surface), "getContext").mockReturnValue(
      context as never,
    );
    api.configureSurface(id, surface, {
      format: "bgra8unorm",
      alpha: "opaque",
      width: 128,
      height: 96,
    });
    const descriptor: W.RenderPassDescriptor = {
        colors: [
          {
            target: { tag: "surface", val: surface },
            clear: { r: 0, g: 0, b: 0, a: 1 },
            load: "clear",
            store: "store",
          },
        ],
      },
      frame = api.beginFrame(id);
    api.encodeRenderPass(frame, descriptor, []);
    api.encodeRenderPass(frame, descriptor, []);
    expect(context.getCurrentTexture).toHaveBeenCalledOnce();
    expect(current.createView).toHaveBeenCalledOnce();
    api.configureSurface(id, surface, {
      format: "bgra8unorm",
      alpha: "opaque",
      width: 64,
      height: 64,
    });
    expect(() => api.submitFrame(frame)).toThrow("resized");
    controller.abort();
    expect(context.unconfigure).toHaveBeenCalledOnce();
  });
  it("supports opt-in pass timestamps on the same frame without normal-frame readback", async () => {
    const { api, id, encoder, device } = await setup(["timestamp-query"]),
      queries = api.createTimestampQuerySet(id, 2),
      result = api.createBuffer(id, 256, 512 | 4),
      color = tex(api, id),
      frame = api.beginFrame(id);
    api.encodeRenderPass(
      frame,
      {
        ...colorPass(color.view),
        timestamps: { queries, beginning: 0, end: 1 },
      },
      [],
    );
    api.resolveTimestamps(frame, queries, 0, 2, result, 0);
    api.submitFrame(frame);
    expect(encoder.resolveQuerySet).toHaveBeenCalledWith(
      expect.anything(),
      0,
      2,
      expect.anything(),
      0,
    );
    expect(device.queue.submit).toHaveBeenCalledOnce();
    expect(device.createBuffer).toHaveBeenCalledOnce();
  });
  it("rejects cross-device/stale resources and destroys native objects exactly once", async () => {
    const { api, id, device, controller } = await setup(),
      second = await api.requestDevice(undefined),
      b = api.createBuffer(id, 64, 64);
    // Mock returns the same native device; cross-device proof uses a real distinct mock.
    const other = mockDevice();
    vi.stubGlobal("navigator", {
      gpu: {
        requestAdapter: async () => ({
          requestDevice: async () => other.device,
        }),
        getPreferredCanvasFormat: () => "bgra8unorm",
      },
    });
    const third = await api.requestDevice(undefined),
      layout = api.createBindGroupLayout(third, [
        {
          binding: 0,
          visibility: 1,
          layout: {
            tag: "buffer",
            val: { kind: "uniform", dynamic: false, minBindingSize: 16 },
          },
        },
      ]);
    expect(() =>
      api.createBindGroup(layout, [
        {
          binding: 0,
          resource: { tag: "buffer", val: { buffer: b, offset: 0, size: 64 } },
        },
      ]),
    ).toThrow("another device");
    api.destroy(b);
    expect(() => api.writeBuffer(b, 0, new Uint8Array(4))).toThrow("handle");
    api.destroy(second);
    controller.abort();
    expect(other.device.destroy).toHaveBeenCalledOnce();
    expect(
      device.createBuffer.mock.results[0]!.value.destroy,
    ).toHaveBeenCalledOnce();
  });
});
