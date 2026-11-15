/// <reference types="@webgpu/types" />
import type { BrowserImports } from "@druid-ui/client/types";
import type * as W from "druid:openui/webgpu";
import { Resources, dimensions } from "./resources";
import type { Surfaces } from "./surfaces";

type Owned = { device: GPUDevice };
type Buffer = Owned & {
  buffer: GPUBuffer;
  size: number;
  usage: number;
  dead: boolean;
};
type Texture = Owned & {
  texture: GPUTexture;
  descriptor: W.TextureDescriptor;
  dead: boolean;
};
type View = Owned & {
  view: GPUTextureView;
  texture: Texture;
  descriptor: W.ViewDescriptor;
};
type Layout = Owned & { layout: GPUBindGroupLayout; entries: W.LayoutEntry[] };
type Pipeline = Owned & {
  pipeline: GPURenderPipeline | GPUComputePipeline;
  kind: "render" | "compute";
  layouts: Layout[];
  descriptor?: W.RenderPipelineDescriptor;
};
type Dynamic = {
  buffer: Buffer;
  offset: number;
  size: number;
  alignment: number;
};
type Group = Owned & {
  group: GPUBindGroup;
  layout: Layout;
  dynamic: Dynamic[];
  dependencies: (Buffer | Texture)[];
};
type Queries = Owned & { queries: GPUQuerySet; count: number };
type Configuration = Owned & {
  context: GPUCanvasContext;
  descriptor: W.SurfaceConfiguration;
  epoch: number;
};
type Frame = Owned & {
  encoder: GPUCommandEncoder;
  failed: boolean;
  surfaces: Map<
    number,
    { configuration: Configuration; epoch: number; view: GPUTextureView }
  >;
};
type State = {
  lost?: string;
  validationError?: string;
  features: W.DeviceFeature[];
  children: Set<number>;
  canvases: Set<HTMLCanvasElement>;
};
const B = {
  MAP_READ: 1,
  COPY_SRC: 4,
  COPY_DST: 8,
  INDEX: 16,
  VERTEX: 32,
  UNIFORM: 64,
  STORAGE: 128,
  INDIRECT: 256,
  QUERY_RESOLVE: 512,
};
const T = {
  COPY_SRC: 1,
  COPY_DST: 2,
  TEXTURE_BINDING: 4,
  STORAGE_BINDING: 8,
  RENDER_ATTACHMENT: 16,
};
const viewDimension = (d: W.ViewDimension): GPUTextureViewDimension =>
  ({
    d1: "1d",
    d2: "2d",
    "d2-array": "2d-array",
    cube: "cube",
    "cube-array": "cube-array",
    d3: "3d",
  })[d] as GPUTextureViewDimension;
const textureDimension = (d: W.TextureDimension): GPUTextureDimension =>
  ({ d1: "1d", d2: "2d", d3: "3d" })[d] as GPUTextureDimension;
const depthFormat = (format: W.TextureFormat) => format.startsWith("depth");
const positive = (n: number, label: string) => {
  if (!Number.isSafeInteger(n) || n < 1 || n > 0xffffffff)
    throw new Error(`Invalid ${label}`);
};
const finite = (...values: number[]) => {
  if (!values.every(Number.isFinite))
    throw new Error("Nonfinite GPU descriptor");
};
const compressedFeature = (
  format: W.TextureFormat,
): W.DeviceFeature | undefined =>
  format.startsWith("astc-")
    ? "texture-compression-astc"
    : format.startsWith("bc7-")
      ? "texture-compression-bc"
      : undefined;
const blockSize = (format: W.TextureFormat) =>
  compressedFeature(format) ? 4 : 1;
const bytesPerBlock = (format: W.TextureFormat) =>
  ({
    r8unorm: 1,
    rgba8unorm: 4,
    "rgba8unorm-srgb": 4,
    bgra8unorm: 4,
    "bgra8unorm-srgb": 4,
    rgba16float: 8,
    r32float: 4,
    rg32float: 8,
    rgba32float: 16,
    depth16unorm: 2,
    depth24plus: 0,
    depth32float: 4,
    "astc-4x4-unorm": 16,
    "astc-4x4-unorm-srgb": 16,
    "bc7-rgba-unorm": 16,
    "bc7-rgba-unorm-srgb": 16,
  })[format];

/** Native WebGPU. No WebGL emulation, implicit readback, draw-time allocation or submission. */
export function webgpu(
  surfaces: Surfaces,
  resources: Resources,
): BrowserImports["druid:openui/webgpu"] {
  const devices = new WeakMap<GPUDevice, State>();
  const configured = new WeakMap<HTMLCanvasElement, Configuration>();
  const state = (device: GPUDevice) => {
    const s = devices.get(device);
    if (!s) throw new Error("WebGPU device closed");
    return s;
  };
  const check = (device: GPUDevice) => {
    const s = state(device);
    if (s.lost) throw new Error(s.lost);
    return device;
  };
  const device = (id: number) =>
    check(resources.get<GPUDevice>(id, "gpu-device"));
  const own = <V extends Owned>(
    id: number,
    kind: string,
    expected?: GPUDevice,
  ): V => {
    const value = resources.get<V>(id, kind);
    check(value.device);
    if (expected && value.device !== expected)
      throw new Error("GPU resource belongs to another device");
    return value;
  };
  const add = <V extends Owned>(
    kind: string,
    value: V,
    release: () => void = () => {},
  ) => {
    const s = state(value.device);
    let id = 0;
    id = resources.add(kind, value, () => {
      s.children.delete(id);
      release();
    });
    s.children.add(id);
    return id;
  };
  const buffer = (id: number, expected?: GPUDevice) => {
    const b = own<Buffer>(id, "gpu-buffer", expected);
    if (b.dead) throw new Error("GPU buffer destroyed");
    return b;
  };
  const texture = (id: number, expected?: GPUDevice) => {
    const t = own<Texture>(id, "gpu-texture", expected);
    if (t.dead) throw new Error("GPU texture destroyed");
    return t;
  };
  const view = (id: number, expected?: GPUDevice) => {
    const v = own<View>(id, "gpu-view", expected);
    if (v.texture.dead) throw new Error("GPU texture destroyed");
    return v;
  };
  const pipeline = (
    id: number,
    kind: Pipeline["kind"],
    expected: GPUDevice,
  ) => {
    const p = own<Pipeline>(id, "gpu-pipeline", expected);
    if (p.kind !== kind) throw new Error(`Expected ${kind} pipeline`);
    return p;
  };
  const range = (b: Buffer, offset: number, size: number, alignment = 4) => {
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(size) ||
      offset < 0 ||
      size < 1 ||
      offset % alignment ||
      size % alignment ||
      offset + size > b.size
    )
      throw new Error("Invalid/alignment-incorrect GPU buffer range");
  };
  const usage = (actual: number, required: number, label: string) => {
    if ((actual & required) !== required)
      throw new Error(`${label} usage missing`);
  };
  const frame = (id: number) => {
    const f = own<Frame>(id, "gpu-frame");
    if (f.failed)
      throw new Error("GPU frame invalid; destroy and begin another frame");
    return f;
  };
  const record = (id: number, encode: (f: Frame) => void) => {
    const f = frame(id);
    try {
      encode(f);
    } catch (e) {
      f.failed = true;
      throw e;
    }
  };
  const extent = (size: W.Extent) => {
    positive(size.width, "texture width");
    positive(size.height, "texture height");
    positive(size.depthOrArrayLayers, "texture depth/layers");
  };
  const copyTexture = (
    copy: W.TextureCopy,
    size: W.Extent,
    expected?: GPUDevice,
  ) => {
    const t = texture(copy.texture, expected);
    extent(size);
    const d = t.descriptor,
      mip = copy.mipLevel;
    if (!Number.isInteger(mip) || mip < 0 || mip >= d.mipLevelCount)
      throw new Error("Invalid texture mip level");
    const block = blockSize(d.format);
    const limit = [
      Math.ceil(Math.max(1, d.size.width >> mip) / block) * block,
      Math.ceil(Math.max(1, d.size.height >> mip) / block) * block,
      d.dimension === "d3"
        ? Math.max(1, d.size.depthOrArrayLayers >> mip)
        : d.size.depthOrArrayLayers,
    ];
    if (
      copy.origin.x % block ||
      copy.origin.y % block ||
      size.width % block ||
      size.height % block
    )
      throw new Error("Compressed texture copy must be block aligned");
    if (
      [copy.origin.x, copy.origin.y, copy.origin.z].some(
        (v, i) =>
          !Number.isInteger(v) ||
          v < 0 ||
          v + [size.width, size.height, size.depthOrArrayLayers][i]! >
            limit[i]!,
      )
    )
      throw new Error("Texture copy out of bounds");
    if (d.sampleCount !== 1)
      throw new Error("Cannot copy multisampled texture");
    if (
      depthFormat(d.format) &&
      (size.width !== limit[0] ||
        size.height !== limit[1] ||
        size.depthOrArrayLayers !== limit[2])
    )
      throw new Error("Depth texture copies must cover the full subresource");
    return {
      t,
      native: { texture: t.texture, mipLevel: mip, origin: copy.origin },
    };
  };
  const stage = (d: GPUDevice, s: W.ShaderStage): GPUProgrammableStage => ({
    module: own<Owned & { shader: GPUShaderModule }>(s.shader, "gpu-shader", d)
      .shader,
    entryPoint: s.entry,
  });
  const layouts = (d: GPUDevice, ids: Uint32Array) =>
    Array.from(ids, (id) => own<Layout>(id, "gpu-layout", d));
  const stamp = (
    d: GPUDevice,
    writes?: W.TimestampWrites,
  ): GPURenderPassTimestampWrites | undefined => {
    if (!writes) return undefined;
    const q = own<Queries>(writes.queries, "gpu-queries", d);
    for (const index of [writes.beginning, writes.end])
      if (
        index !== undefined &&
        (!Number.isInteger(index) || index < 0 || index >= q.count)
      )
        throw new Error("Timestamp query out of range");
    if (writes.beginning === undefined && writes.end === undefined)
      throw new Error("Timestamp writes need an index");
    if (writes.beginning !== undefined && writes.beginning === writes.end)
      throw new Error("Timestamp indices must differ");
    return {
      querySet: q.queries,
      beginningOfPassWriteIndex: writes.beginning,
      endOfPassWriteIndex: writes.end,
    };
  };
  const setGroup = (
    pass: GPUComputePassEncoder | GPURenderPassEncoder,
    d: GPUDevice,
    command: W.GroupCommand,
    current?: Pipeline,
  ) => {
    const g = own<Group>(command.group, "gpu-group", d);
    if (
      command.index >= d.limits.maxBindGroups ||
      (current && current.layouts[command.index] !== g.layout)
    )
      throw new Error("Bind group layout/index does not match pipeline");
    if (command.dynamicOffsets.length !== g.dynamic.length)
      throw new Error("Dynamic offset count mismatch");
    for (const dependency of g.dependencies)
      if (dependency.dead) throw new Error("Bind group resource destroyed");
    g.dynamic.forEach((binding, i) => {
      const offset = command.dynamicOffsets[i]!;
      if (
        offset % binding.alignment ||
        binding.offset + offset + binding.size > binding.buffer.size
      )
        throw new Error("Dynamic buffer offset alignment/range invalid");
    });
    pass.setBindGroup(command.index, g.group, command.dynamicOffsets);
  };
  const indirect = (d: GPUDevice, command: W.IndirectCommand, size: number) => {
    const b = buffer(command.buffer, d);
    usage(b.usage, B.INDIRECT, "INDIRECT");
    range(b, command.offset, size);
    return b.buffer;
  };

  return {
    available: () => typeof navigator !== "undefined" && !!navigator.gpu,
    async requestDevice(options) {
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: options?.power,
      });
      if (!adapter)
        throw new Error(
          "WebGPU adapter unavailable (requires HTTPS/localhost and a supported browser/device)",
        );
      const features = [...new Set(options?.features ?? [])].filter((feature) =>
        adapter.features.has(feature),
      );
      const d = await adapter.requestDevice({ requiredFeatures: features });
      const s: State = { features, children: new Set(), canvases: new Set() };
      devices.set(d, s);
      d.addEventListener?.("uncapturederror", (event) => {
        s.validationError = event.error.message;
      });
      void d.lost.then((info) => {
        s.lost ??= `WebGPU device lost: ${info.message}`;
      });
      return resources.add("gpu-device", d, () => {
        s.lost = "WebGPU device closed";
        for (const id of [...s.children].reverse()) resources.remove(id);
        for (const canvas of s.canvases) {
          const c = configured.get(canvas);
          if (c?.device === d) {
            c.context.unconfigure();
            configured.delete(canvas);
          }
        }
        d.destroy();
      });
    },
    getDeviceInfo(id) {
      const d = device(id),
        l = d.limits;
      return {
        preferredFormat:
          navigator.gpu.getPreferredCanvasFormat() as W.TextureFormat,
        minUniformBufferOffsetAlignment: l.minUniformBufferOffsetAlignment,
        minStorageBufferOffsetAlignment: l.minStorageBufferOffsetAlignment,
        maxUniformBufferBindingSize: l.maxUniformBufferBindingSize,
        maxStorageBufferBindingSize: l.maxStorageBufferBindingSize,
        maxBufferSize: Math.min(0xffffffff, l.maxBufferSize),
        maxTextureDimension2d: l.maxTextureDimension2D,
        maxBindGroups: l.maxBindGroups,
        maxVertexBuffers: l.maxVertexBuffers,
        maxComputeWorkgroupsPerDimension: l.maxComputeWorkgroupsPerDimension,
        features: [...state(d).features],
      };
    },
    getDeviceState(id) {
      const s = state(resources.get<GPUDevice>(id, "gpu-device"));
      return { lost: s.lost, validationError: s.validationError };
    },
    createBuffer(id, size, flags) {
      const d = device(id);
      positive(size, "GPU buffer size");
      if (
        size % 4 ||
        size > d.limits.maxBufferSize ||
        !flags ||
        flags & ~0x3ff ||
        (flags & 1 && flags & ~(1 | B.COPY_DST)) ||
        (flags & 2 && flags & ~(2 | B.COPY_SRC))
      )
        throw new Error(
          "GPU buffer size/usage invalid; size must be a positive multiple of four",
        );
      const b: Buffer = {
        device: d,
        buffer: d.createBuffer({ size, usage: flags }),
        size,
        usage: flags,
        dead: false,
      };
      return add("gpu-buffer", b, () => {
        b.dead = true;
        b.buffer.destroy();
      });
    },
    writeBuffer(id, offset, data) {
      const b = buffer(id);
      range(b, offset, data.byteLength);
      usage(b.usage, B.COPY_DST, "COPY_DST");
      b.device.queue.writeBuffer(
        b.buffer,
        offset,
        data as Uint8Array<ArrayBuffer>,
      );
    },
    createTexture(id, descriptor) {
      const d = device(id);
      extent(descriptor.size);
      positive(descriptor.mipLevelCount, "mip count");
      const compression = compressedFeature(descriptor.format);
      if (compression) {
        if (!state(d).features.includes(compression))
          throw new Error(`Texture format requires enabled ${compression}`);
        if (
          descriptor.dimension !== "d2" ||
          descriptor.sampleCount !== 1 ||
          descriptor.size.width % 4 ||
          descriptor.size.height % 4 ||
          descriptor.usage & (T.STORAGE_BINDING | T.RENDER_ATTACHMENT)
        )
          throw new Error(
            "Compressed textures require block-aligned 2D dimensions, one sample and sampled/copy usage",
          );
      }
      const max =
        descriptor.dimension === "d3"
          ? d.limits.maxTextureDimension3D
          : descriptor.dimension === "d1"
            ? d.limits.maxTextureDimension1D
            : d.limits.maxTextureDimension2D;
      if (
        descriptor.size.width > max ||
        descriptor.size.height > max ||
        (descriptor.dimension === "d1" &&
          (descriptor.size.height !== 1 ||
            descriptor.size.depthOrArrayLayers !== 1)) ||
        (descriptor.dimension === "d3" &&
          descriptor.size.depthOrArrayLayers > max) ||
        (descriptor.dimension === "d2" &&
          descriptor.size.depthOrArrayLayers >
            d.limits.maxTextureArrayLayers) ||
        descriptor.mipLevelCount >
          Math.floor(
            Math.log2(
              Math.max(
                descriptor.size.width,
                descriptor.size.height,
                descriptor.dimension === "d3"
                  ? descriptor.size.depthOrArrayLayers
                  : 1,
              ),
            ),
          ) +
            1 ||
        (descriptor.sampleCount > 1 &&
          (descriptor.dimension !== "d2" ||
            descriptor.size.depthOrArrayLayers !== 1 ||
            descriptor.mipLevelCount !== 1 ||
            !(descriptor.usage & T.RENDER_ATTACHMENT) ||
            descriptor.usage &
              (T.COPY_SRC | T.COPY_DST | T.STORAGE_BINDING))) ||
        ![1, 4].includes(descriptor.sampleCount) ||
        !descriptor.usage ||
        descriptor.usage & ~31
      )
        throw new Error("Invalid texture dimensions/sample count/usage");
      const t: Texture = {
        device: d,
        texture: d.createTexture({
          size: descriptor.size,
          dimension: textureDimension(descriptor.dimension),
          format: descriptor.format,
          mipLevelCount: descriptor.mipLevelCount,
          sampleCount: descriptor.sampleCount,
          usage: descriptor.usage,
        }),
        descriptor: { ...descriptor, size: { ...descriptor.size } },
        dead: false,
      };
      return add("gpu-texture", t, () => {
        t.dead = true;
        t.texture.destroy();
      });
    },
    createTextureView(id, descriptor) {
      const t = texture(id),
        mips =
          descriptor.mipLevelCount ??
          t.descriptor.mipLevelCount - descriptor.baseMipLevel;
      const layers =
        descriptor.arrayLayerCount ??
        t.descriptor.size.depthOrArrayLayers - descriptor.baseArrayLayer;
      if (
        (descriptor.aspect === "depth-only" &&
          !depthFormat(t.descriptor.format)) ||
        descriptor.baseMipLevel + mips > t.descriptor.mipLevelCount ||
        mips < 1 ||
        descriptor.baseArrayLayer + layers >
          t.descriptor.size.depthOrArrayLayers ||
        layers < 1
      )
        throw new Error("Texture view subresource out of bounds");
      const native = t.texture.createView({
        dimension: viewDimension(descriptor.dimension),
        aspect: descriptor.aspect,
        baseMipLevel: descriptor.baseMipLevel,
        mipLevelCount: descriptor.mipLevelCount,
        baseArrayLayer: descriptor.baseArrayLayer,
        arrayLayerCount: descriptor.arrayLayerCount,
      });
      return add("gpu-view", {
        device: t.device,
        texture: t,
        view: native,
        descriptor: { ...descriptor },
      });
    },
    writeTexture(destination, size, data, bytesPerRow, rowsPerImage) {
      const { t, native } = copyTexture(destination, size);
      usage(t.descriptor.usage, T.COPY_DST, "texture COPY_DST");
      const bytes = bytesPerBlock(t.descriptor.format);
      if (!bytes || depthFormat(t.descriptor.format))
        throw new Error("Depth textures cannot use this pixel upload path");
      const block = blockSize(t.descriptor.format);
      const row = (size.width / block) * bytes;
      const rows = size.height / block;
      if (
        !Number.isInteger(bytesPerRow) ||
        bytesPerRow < row ||
        bytesPerRow % bytes ||
        !Number.isInteger(rowsPerImage) ||
        rowsPerImage < rows ||
        data.byteLength <
          bytesPerRow *
            (rowsPerImage * (size.depthOrArrayLayers - 1) + rows - 1) +
            row
      )
        throw new Error("Texture upload layout/data out of bounds");
      t.device.queue.writeTexture(
        native,
        data as Uint8Array<ArrayBuffer>,
        { bytesPerRow, rowsPerImage },
        size,
      );
    },
    createSampler(id, descriptor) {
      const d = device(id);
      finite(descriptor.lodMinClamp, descriptor.lodMaxClamp);
      if (
        descriptor.lodMinClamp < 0 ||
        descriptor.lodMaxClamp < descriptor.lodMinClamp ||
        descriptor.maxAnisotropy < 1 ||
        descriptor.maxAnisotropy > 16 ||
        (descriptor.maxAnisotropy > 1 &&
          [
            descriptor.magFilter,
            descriptor.minFilter,
            descriptor.mipmapFilter,
          ].some((filter) => filter !== "linear"))
      )
        throw new Error("Invalid sampler LOD/anisotropy");
      const sampler = d.createSampler({
        addressModeU: descriptor.addressU,
        addressModeV: descriptor.addressV,
        addressModeW: descriptor.addressW,
        magFilter: descriptor.magFilter,
        minFilter: descriptor.minFilter,
        mipmapFilter: descriptor.mipmapFilter,
        lodMinClamp: descriptor.lodMinClamp,
        lodMaxClamp: descriptor.lodMaxClamp,
        compare: descriptor.compare,
        maxAnisotropy: descriptor.maxAnisotropy,
      });
      return add("gpu-sampler", { device: d, sampler });
    },
    async createShader(id, wgsl) {
      const d = device(id),
        shader = d.createShaderModule({ code: wgsl });
      const info = await shader.getCompilationInfo();
      check(d);
      const errors = info.messages.filter(
        (message) => message.type === "error",
      );
      if (errors.length)
        throw new Error(
          errors
            .map(
              (message) =>
                `${message.lineNum}:${message.linePos} ${message.message}`,
            )
            .join("\n"),
        );
      return add("gpu-shader", { device: d, shader });
    },
    createBindGroupLayout(id, entries) {
      const d = device(id),
        seen = new Set<number>();
      const native: GPUBindGroupLayoutEntry[] = entries.map((entry) => {
        if (
          seen.has(entry.binding) ||
          !entry.visibility ||
          entry.visibility & ~7
        )
          throw new Error("Invalid/duplicate bind group layout entry");
        seen.add(entry.binding);
        const base = { binding: entry.binding, visibility: entry.visibility };
        switch (entry.layout.tag) {
          case "buffer":
            return {
              ...base,
              buffer: {
                type: entry.layout.val.kind,
                hasDynamicOffset: entry.layout.val.dynamic,
                minBindingSize: entry.layout.val.minBindingSize,
              },
            };
          case "sampler":
            return { ...base, sampler: { type: entry.layout.val } };
          case "texture":
            return {
              ...base,
              texture: {
                sampleType: entry.layout.val.sampleType,
                viewDimension: viewDimension(entry.layout.val.dimension),
                multisampled: entry.layout.val.multisampled,
              },
            };
          case "storage-texture":
            return {
              ...base,
              storageTexture: {
                access: entry.layout.val.access,
                format: entry.layout.val.format,
                viewDimension: viewDimension(entry.layout.val.dimension),
              },
            };
        }
      });
      return add("gpu-layout", {
        device: d,
        layout: d.createBindGroupLayout({ entries: native }),
        entries: structuredClone(entries),
      });
    },
    createBindGroup(id, entries) {
      const l = own<Layout>(id, "gpu-layout"),
        d = l.device,
        dynamic: { binding: number; value: Dynamic }[] = [],
        dependencies: (Buffer | Texture)[] = [],
        seen = new Set<number>();
      if (entries.length !== l.entries.length)
        throw new Error("Bind group entry count mismatch");
      const native: GPUBindGroupEntry[] = entries.map((entry) => {
        const layout = l.entries.find(
          (candidate) => candidate.binding === entry.binding,
        )?.layout;
        if (!layout || seen.has(entry.binding))
          throw new Error("Invalid/duplicate bind group entry");
        seen.add(entry.binding);
        switch (entry.resource.tag) {
          case "buffer": {
            if (layout.tag !== "buffer")
              throw new Error("Expected buffer binding");
            const b = buffer(entry.resource.val.buffer, d),
              offset = entry.resource.val.offset,
              size = entry.resource.val.size ?? b.size - offset,
              uniform = layout.val.kind === "uniform";
            const alignment = uniform
              ? d.limits.minUniformBufferOffsetAlignment
              : d.limits.minStorageBufferOffsetAlignment;
            range(b, offset, size);
            usage(b.usage, uniform ? B.UNIFORM : B.STORAGE, "binding buffer");
            if (
              offset % alignment ||
              size < layout.val.minBindingSize ||
              size >
                (uniform
                  ? d.limits.maxUniformBufferBindingSize
                  : d.limits.maxStorageBufferBindingSize)
            )
              throw new Error("Buffer binding alignment/size invalid");
            if (layout.val.dynamic)
              dynamic.push({
                binding: entry.binding,
                value: { buffer: b, offset, size, alignment },
              });
            dependencies.push(b);
            return {
              binding: entry.binding,
              resource: { buffer: b.buffer, offset, size },
            };
          }
          case "sampler": {
            if (layout.tag !== "sampler")
              throw new Error("Expected sampler binding");
            return {
              binding: entry.binding,
              resource: own<Owned & { sampler: GPUSampler }>(
                entry.resource.val,
                "gpu-sampler",
                d,
              ).sampler,
            };
          }
          case "texture-view": {
            if (layout.tag !== "texture" && layout.tag !== "storage-texture")
              throw new Error("Expected texture binding");
            const v = view(entry.resource.val, d);
            usage(
              v.texture.descriptor.usage,
              layout.tag === "texture" ? T.TEXTURE_BINDING : T.STORAGE_BINDING,
              "binding texture",
            );
            dependencies.push(v.texture);
            return { binding: entry.binding, resource: v.view };
          }
        }
      });
      return add("gpu-group", {
        device: d,
        group: d.createBindGroup({ layout: l.layout, entries: native }),
        layout: l,
        dynamic: dynamic
          .sort((a, b) => a.binding - b.binding)
          .map((item) => item.value),
        dependencies,
      });
    },
    async createRenderPipeline(id, descriptor) {
      const d = device(id),
        ls = layouts(d, descriptor.layouts);
      if (
        ![1, 4].includes(descriptor.sampleCount) ||
        (!descriptor.fragment && descriptor.colors.length)
      )
        throw new Error("Invalid pipeline fragment/sample state");
      const native = await d.createRenderPipelineAsync({
        layout: d.createPipelineLayout({
          bindGroupLayouts: ls.map((l) => l.layout),
        }),
        vertex: {
          ...stage(d, descriptor.vertex),
          buffers: descriptor.vertexBuffers.map((b) => ({
            arrayStride: b.stride,
            stepMode: b.step,
            attributes: b.attributes.map((a) => ({
              format: a.format,
              offset: a.offset,
              shaderLocation: a.location,
            })),
          })),
        },
        fragment: descriptor.fragment
          ? {
              ...stage(d, descriptor.fragment),
              targets: descriptor.colors.map((c) => ({
                format: c.format,
                writeMask: c.writeMask,
                blend: c.blend
                  ? {
                      color: {
                        srcFactor: c.blend.color.src,
                        dstFactor: c.blend.color.dst,
                        operation: c.blend.color.operation,
                      },
                      alpha: {
                        srcFactor: c.blend.alpha.src,
                        dstFactor: c.blend.alpha.dst,
                        operation: c.blend.alpha.operation,
                      },
                    }
                  : undefined,
              })),
            }
          : undefined,
        primitive: {
          topology: descriptor.primitive.topology,
          frontFace: descriptor.primitive.front,
          cullMode: descriptor.primitive.cull,
          stripIndexFormat: descriptor.primitive.stripIndexFormat,
        },
        depthStencil: descriptor.depth
          ? {
              format: descriptor.depth.format,
              depthWriteEnabled: descriptor.depth.write,
              depthCompare: descriptor.depth.compare,
              depthBias: descriptor.depth.bias,
              depthBiasSlopeScale: descriptor.depth.biasSlopeScale,
              depthBiasClamp: descriptor.depth.biasClamp,
            }
          : undefined,
        multisample: {
          count: descriptor.sampleCount,
          alphaToCoverageEnabled: descriptor.alphaToCoverage,
        },
      });
      check(d);
      return add("gpu-pipeline", {
        device: d,
        pipeline: native,
        kind: "render",
        layouts: ls,
        descriptor: structuredClone(descriptor),
      });
    },
    async createComputePipeline(id, descriptor) {
      const d = device(id),
        ls = layouts(d, descriptor.layouts);
      const native = await d.createComputePipelineAsync({
        layout: d.createPipelineLayout({
          bindGroupLayouts: ls.map((l) => l.layout),
        }),
        compute: stage(d, descriptor.stage),
      });
      check(d);
      return add("gpu-pipeline", {
        device: d,
        pipeline: native,
        kind: "compute",
        layouts: ls,
      });
    },
    configureSurface(id, surface, descriptor) {
      const d = device(id),
        canvas = surfaces.getCanvas(surface);
      dimensions(descriptor.width, descriptor.height);
      if (
        Math.max(descriptor.width, descriptor.height) >
          d.limits.maxTextureDimension2D ||
        !["rgba8unorm", "bgra8unorm", "rgba16float"].includes(descriptor.format)
      )
        throw new Error("Unsupported surface format/dimensions");
      const context = canvas.getContext("webgpu");
      if (!context)
        throw new Error(
          "WebGPU canvas unavailable or surface uses another context",
        );
      if (canvas.width !== descriptor.width) canvas.width = descriptor.width;
      if (canvas.height !== descriptor.height)
        canvas.height = descriptor.height;
      context.configure({
        device: d,
        format: descriptor.format,
        alphaMode: descriptor.alpha,
      });
      const epoch = (configured.get(canvas)?.epoch ?? 0) + 1;
      configured.set(canvas, {
        device: d,
        context,
        descriptor: { ...descriptor },
        epoch,
      });
      state(d).canvases.add(canvas);
    },
    beginFrame(id) {
      const d = device(id);
      return add("gpu-frame", {
        device: d,
        encoder: d.createCommandEncoder(),
        failed: false,
        surfaces: new Map(),
      });
    },
    createTimestampQuerySet(id, count) {
      const d = device(id);
      positive(count, "query count");
      if (!state(d).features.includes("timestamp-query") || count > 4096)
        throw new Error("Timestamp query feature unavailable/count invalid");
      const q = d.createQuerySet({ type: "timestamp", count });
      return add("gpu-queries", { device: d, queries: q, count }, () =>
        q.destroy(),
      );
    },
    encodeRenderPass(id, descriptor, commands) {
      record(id, (f) => {
        const colors: GPURenderPassColorAttachment[] = descriptor.colors.map(
          (c) => {
            let target: GPUTextureView;
            if (c.target.tag === "surface") {
              const canvas = surfaces.getCanvas(c.target.val),
                configuration = configured.get(canvas);
              if (!configuration || configuration.device !== f.device)
                throw new Error("Surface not configured for this device");
              let cached = f.surfaces.get(c.target.val);
              if (cached && cached.epoch !== configuration.epoch)
                throw new Error("Surface resized during frame");
              if (!cached) {
                cached = {
                  configuration,
                  epoch: configuration.epoch,
                  view: configuration.context.getCurrentTexture().createView(),
                };
                f.surfaces.set(c.target.val, cached);
              }
              target = cached.view;
            } else {
              const v = view(c.target.val, f.device);
              usage(
                v.texture.descriptor.usage,
                T.RENDER_ATTACHMENT,
                "color attachment",
              );
              if (depthFormat(v.texture.descriptor.format))
                throw new Error("Depth texture is not a color attachment");
              target = v.view;
            }
            finite(c.clear.r, c.clear.g, c.clear.b, c.clear.a);
            return {
              view: target,
              resolveTarget:
                c.resolve === undefined
                  ? undefined
                  : view(c.resolve, f.device).view,
              loadOp: c.load,
              storeOp: c.store,
              clearValue: c.clear,
            };
          },
        );
        const depth = descriptor.depth,
          depthView = depth ? view(depth.view, f.device) : undefined;
        if (depthView) {
          usage(
            depthView.texture.descriptor.usage,
            T.RENDER_ATTACHMENT,
            "depth attachment",
          );
          if (!depthFormat(depthView.texture.descriptor.format))
            throw new Error("Expected depth texture");
          finite(depth!.clear);
          if (depth!.clear < 0 || depth!.clear > 1)
            throw new Error("Depth clear outside0..1");
        }
        if (!colors.length && !depth)
          throw new Error("Render pass needs an attachment");
        const pass = f.encoder.beginRenderPass({
          colorAttachments: colors,
          depthStencilAttachment:
            depth && depthView
              ? {
                  view: depthView.view,
                  depthReadOnly: depth.readOnly,
                  depthLoadOp: depth.readOnly ? undefined : depth.load,
                  depthStoreOp: depth.readOnly ? undefined : depth.store,
                  depthClearValue: depth.readOnly ? undefined : depth.clear,
                }
              : undefined,
          timestampWrites: stamp(f.device, descriptor.timestamps),
        });
        let current: Pipeline | undefined,
          indexed = false;
        try {
          for (const c of commands)
            switch (c.tag) {
              case "pipeline":
                current = pipeline(c.val, "render", f.device);
                pass.setPipeline(current.pipeline as GPURenderPipeline);
                break;
              case "group":
                setGroup(pass, f.device, c.val, current);
                break;
              case "vertex-buffer": {
                const b = buffer(c.val.buffer, f.device),
                  size = c.val.size ?? b.size - c.val.offset;
                usage(b.usage, B.VERTEX, "VERTEX");
                range(b, c.val.offset, size);
                if (c.val.slot >= f.device.limits.maxVertexBuffers)
                  throw new Error("Vertex buffer slot invalid");
                pass.setVertexBuffer(c.val.slot, b.buffer, c.val.offset, size);
                break;
              }
              case "index-buffer": {
                const b = buffer(c.val.buffer, f.device),
                  size = c.val.size ?? b.size - c.val.offset;
                usage(b.usage, B.INDEX, "INDEX");
                range(b, c.val.offset, size, c.val.format === "uint16" ? 2 : 4);
                pass.setIndexBuffer(b.buffer, c.val.format, c.val.offset, size);
                indexed = true;
                break;
              }
              case "viewport":
                finite(
                  c.val.x,
                  c.val.y,
                  c.val.width,
                  c.val.height,
                  c.val.minDepth,
                  c.val.maxDepth,
                );
                pass.setViewport(
                  c.val.x,
                  c.val.y,
                  c.val.width,
                  c.val.height,
                  c.val.minDepth,
                  c.val.maxDepth,
                );
                break;
              case "scissor":
                pass.setScissorRect(
                  c.val.x,
                  c.val.y,
                  c.val.width,
                  c.val.height,
                );
                break;
              case "blend-constant":
                finite(c.val.r, c.val.g, c.val.b, c.val.a);
                pass.setBlendConstant(c.val);
                break;
              case "draw":
                if (!current)
                  throw new Error("Set render pipeline before drawing");
                pass.draw(
                  c.val.vertices,
                  c.val.instances,
                  c.val.firstVertex,
                  c.val.firstInstance,
                );
                break;
              case "draw-indexed":
                if (!current || !indexed)
                  throw new Error(
                    "Indexed draw needs pipeline and index buffer",
                  );
                pass.drawIndexed(
                  c.val.indices,
                  c.val.instances,
                  c.val.firstIndex,
                  c.val.baseVertex,
                  c.val.firstInstance,
                );
                break;
              case "draw-indirect":
                if (!current)
                  throw new Error("Set render pipeline before drawing");
                pass.drawIndirect(indirect(f.device, c.val, 16), c.val.offset);
                break;
              case "draw-indexed-indirect":
                if (!current || !indexed)
                  throw new Error(
                    "Indexed draw needs pipeline and index buffer",
                  );
                pass.drawIndexedIndirect(
                  indirect(f.device, c.val, 20),
                  c.val.offset,
                );
                break;
            }
        } finally {
          pass.end();
        }
      });
    },
    encodeComputePass(id, descriptor, commands) {
      record(id, (f) => {
        const pass = f.encoder.beginComputePass({
          timestampWrites: stamp(f.device, descriptor.timestamps),
        });
        let current: Pipeline | undefined;
        try {
          for (const c of commands)
            switch (c.tag) {
              case "pipeline":
                current = pipeline(c.val, "compute", f.device);
                pass.setPipeline(current.pipeline as GPUComputePipeline);
                break;
              case "group":
                setGroup(pass, f.device, c.val, current);
                break;
              case "dispatch":
                if (
                  !current ||
                  [c.val.x, c.val.y, c.val.z].some(
                    (v) => v > f.device.limits.maxComputeWorkgroupsPerDimension,
                  )
                )
                  throw new Error("Compute pipeline/workgroup count invalid");
                pass.dispatchWorkgroups(c.val.x, c.val.y, c.val.z);
                break;
              case "dispatch-indirect":
                if (!current)
                  throw new Error("Set compute pipeline before dispatch");
                pass.dispatchWorkgroupsIndirect(
                  indirect(f.device, c.val, 12),
                  c.val.offset,
                );
                break;
            }
        } finally {
          pass.end();
        }
      });
    },
    resolveTimestamps(id, queries, first, count, destination, offset) {
      record(id, (f) => {
        const q = own<Queries>(queries, "gpu-queries", f.device),
          b = buffer(destination, f.device);
        positive(count, "query resolve count");
        if (first + count > q.count || offset % 256)
          throw new Error("Query resolve range/alignment invalid");
        usage(b.usage, B.QUERY_RESOLVE, "QUERY_RESOLVE");
        range(b, offset, count * 8);
        f.encoder.resolveQuerySet(q.queries, first, count, b.buffer, offset);
      });
    },
    copyBuffer(id, source, sourceOffset, destination, destinationOffset, size) {
      record(id, (f) => {
        const a = buffer(source, f.device),
          b = buffer(destination, f.device);
        range(a, sourceOffset, size);
        range(b, destinationOffset, size);
        usage(a.usage, B.COPY_SRC, "COPY_SRC");
        usage(b.usage, B.COPY_DST, "COPY_DST");
        if (a === b) throw new Error("Cannot copy buffer to itself");
        f.encoder.copyBufferToBuffer(
          a.buffer,
          sourceOffset,
          b.buffer,
          destinationOffset,
          size,
        );
      });
    },
    copyTexture(id, source, destination, size) {
      record(id, (f) => {
        const a = copyTexture(source, size, f.device),
          b = copyTexture(destination, size, f.device);
        usage(a.t.descriptor.usage, T.COPY_SRC, "texture COPY_SRC");
        usage(b.t.descriptor.usage, T.COPY_DST, "texture COPY_DST");
        if (
          a.t.descriptor.format.replace(/-srgb$/, "") !==
          b.t.descriptor.format.replace(/-srgb$/, "")
        )
          throw new Error("Texture copy formats are not compatible");
        f.encoder.copyTextureToTexture(a.native, b.native, size);
      });
    },
    submitFrame(id) {
      const f = frame(id);
      try {
        for (const [surface, cached] of f.surfaces)
          if (
            configured.get(surfaces.getCanvas(surface))?.epoch !== cached.epoch
          )
            throw new Error("Surface resized during frame");
        f.device.queue.submit([f.encoder.finish()]);
      } finally {
        resources.remove(id);
      }
    },
    async readBuffer(id, offset, size) {
      const b = buffer(id);
      range(b, offset, size);
      usage(b.usage, B.COPY_SRC, "COPY_SRC");
      const staging = b.device.createBuffer({
        size,
        usage: B.COPY_DST | B.MAP_READ,
      });
      try {
        const encoder = b.device.createCommandEncoder();
        encoder.copyBufferToBuffer(b.buffer, offset, staging, 0, size);
        b.device.queue.submit([encoder.finish()]);
        await staging.mapAsync(GPUMapMode.READ);
        check(b.device);
        return new Uint8Array(staging.getMappedRange()).slice();
      } finally {
        staging.destroy();
      }
    },
    completed: (id) => device(id).queue.onSubmittedWorkDone(),
    destroy: (id) => resources.remove(id),
  };
}
