import { describe, expect, it, vi } from "vitest";
import { Resources } from "./resources";
import { webgl } from "./webgl";

function fixture() {
  const controller = new AbortController();
  const resources = new Resources(controller.signal);
  const bindings = new Map<number, unknown>();
  const gl = {
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    blendFunc: vi.fn(),
    depthMask: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    TEXTURE_2D: 3553,
    TEXTURE0: 33984,
    RGBA: 6408,
    RGBA8: 32856,
    UNSIGNED_BYTE: 5121,
    MAX_TEXTURE_SIZE: 3379,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
    MAX_RENDERBUFFER_SIZE: 34024,
    DRAW_FRAMEBUFFER_BINDING: 36006,
    READ_FRAMEBUFFER_BINDING: 36010,
    RENDERBUFFER_BINDING: 36007,
    TEXTURE_BINDING_2D: 32873,
    FRAMEBUFFER: 36160,
    DRAW_FRAMEBUFFER: 36009,
    READ_FRAMEBUFFER: 36008,
    RENDERBUFFER: 36161,
    COLOR_ATTACHMENT0: 36064,
    DEPTH_ATTACHMENT: 36096,
    DEPTH_COMPONENT16: 33189,
    FRAMEBUFFER_COMPLETE: 36053,
    NO_ERROR: 0,
    TEXTURE_WRAP_S: 10242,
    TEXTURE_WRAP_T: 10243,
    CLAMP_TO_EDGE: 33071,
    TEXTURE_MIN_FILTER: 10241,
    TEXTURE_MAG_FILTER: 10240,
    LINEAR: 9729,
    LINEAR_MIPMAP_LINEAR: 9987,
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,
    drawingBufferWidth: 960,
    drawingBufferHeight: 640,
    isContextLost: vi.fn(() => false),
    getParameter: vi.fn((key: number): unknown =>
      key === 3379 || key === 34024
        ? 4096
        : key === 35661
          ? 16
          : (bindings.get(key) ?? null),
    ),
    createTexture: vi.fn(() => ({})),
    deleteTexture: vi.fn(),
    bindTexture: vi.fn((_target: number, value: unknown) =>
      bindings.set(32873, value),
    ),
    createFramebuffer: vi.fn(() => ({})),
    deleteFramebuffer: vi.fn(),
    bindFramebuffer: vi.fn((target: number, value: unknown) => {
      if (target === 36160 || target === 36009) bindings.set(36006, value);
      if (target === 36160 || target === 36008) bindings.set(36010, value);
    }),
    createRenderbuffer: vi.fn(() => ({})),
    deleteRenderbuffer: vi.fn(),
    bindRenderbuffer: vi.fn((_target: number, value: unknown) =>
      bindings.set(36007, value),
    ),
    renderbufferStorage: vi.fn(),
    framebufferTexture2D: vi.fn(),
    framebufferRenderbuffer: vi.fn(),
    checkFramebufferStatus: vi.fn(() => 36053),
    getError: vi.fn(() => 0),
    readPixels: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    generateMipmap: vi.fn(),
    activeTexture: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => ({ name })),
    uniform1i: vi.fn(),
    uniform1fv: vi.fn(),
    uniform2fv: vi.fn(),
    uniform3fv: vi.fn(),
    uniform4fv: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    bindBuffer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    disableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    vertexAttribDivisor: vi.fn(),
    drawArrays: vi.fn(),
    drawArraysInstanced: vi.fn(),
  };
  const context = resources.add("webgl", gl);
  const program = resources.add("gl-program", {
    gl,
    value: { program: {}, uniforms: new Map() },
  });
  const api = webgl({} as never, resources);
  return { gl, context, program, api, resources, controller };
}

describe("typed WebGL textures", () => {
  it("controls depth writes independently and rejects lost or released contexts", () => {
    const { gl, api, context, controller } = fixture();
    api.depthMask(context, false);
    api.depthMask(context, true);
    expect(gl.depthMask.mock.calls).toEqual([[false], [true]]);
    expect(gl.enable).not.toHaveBeenCalled();
    expect(gl.disable).not.toHaveBeenCalled();
    gl.isContextLost.mockReturnValueOnce(true);
    expect(() => api.depthMask(context, false)).toThrow("WebGL context lost");
    controller.abort();
    expect(() => api.depthMask(context, false)).toThrow();
    expect(gl.depthMask).toHaveBeenCalledTimes(2);
  });
  it("opts into straight-alpha blending and can restore opaque rendering", () => {
    const { gl, api, context, controller } = fixture();
    api.blend(context, true);
    expect(gl.blendFunc).toHaveBeenCalledWith(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    expect(gl.enable).toHaveBeenCalledWith(gl.BLEND);
    api.blend(context, false);
    expect(gl.disable).toHaveBeenCalledWith(gl.BLEND);
    controller.abort();
    expect(() => api.blend(context, true)).toThrow();
  });
  it("draws persistent instance buffers once and resets divisors before ordinary draws", () => {
    const { gl, api, context, program, resources } = fixture();
    const geometry = resources.add("gl-buffer", { gl, value: {} });
    const transforms = resources.add("gl-buffer", { gl, value: {} });
    const vertices = [
      { buffer: geometry, location: 0, components: 3, stride: 12, offset: 0 },
    ];
    const instances = [0, 1, 2, 3].map((column) => ({
      buffer: transforms,
      location: 4 + column,
      components: 4,
      stride: 64,
      offset: column * 16,
    }));
    const texture = api.createTexture(context, 1, 1, new Uint8Array(4), false);
    api.drawInstanced(
      context,
      program,
      vertices,
      instances,
      [],
      4,
      0,
      300,
      35,
      [{ texture, name: "baseTexture", unit: 0 }],
      undefined,
    );
    expect(gl.drawArraysInstanced).toHaveBeenCalledExactlyOnceWith(
      4,
      0,
      300,
      35,
    );
    expect(gl.vertexAttribDivisor.mock.calls).toEqual([
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
    ]);
    expect(gl.uniform1i).toHaveBeenCalledWith({ name: "baseTexture" }, 0);
    for (const location of [0, 4, 5, 6, 7])
      expect(gl.disableVertexAttribArray).toHaveBeenCalledWith(location);
    api.draw(context, program, vertices, [], 4, 0, 3, undefined);
    expect(gl.drawArrays).toHaveBeenCalledExactlyOnceWith(4, 0, 3);
    expect(gl.vertexAttribDivisor).toHaveBeenCalledTimes(8);
  });

  it("restores instance attribute state when an instanced draw fails", () => {
    const { gl, api, context, program, resources } = fixture();
    const buffer = resources.add("gl-buffer", { gl, value: {} });
    gl.drawArraysInstanced.mockImplementationOnce(() => {
      throw new Error("driver failed");
    });
    expect(() =>
      api.drawInstanced(
        context,
        program,
        [],
        [{ buffer, location: 4, components: 4, stride: 64, offset: 0 }],
        [],
        4,
        0,
        3,
        2,
        [],
        undefined,
      ),
    ).toThrow("driver failed");
    expect(gl.vertexAttribDivisor.mock.calls).toEqual([
      [4, 1],
      [4, 0],
    ]);
    expect(gl.disableVertexAttribArray).toHaveBeenCalledWith(4);
  });

  it("uploads packed RGBA bytes once, applies filtering and optionally generates mipmaps", () => {
    const { gl, api, context } = fixture();
    const pixels = new Uint8Array([0, 127, 255, 255, 255, 0, 127, 255]);
    api.createTexture(context, 2, 1, pixels, true);
    expect(gl.texImage2D).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      2,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    expect(gl.texParameteri).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    expect(gl.texParameteri).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      gl.CLAMP_TO_EDGE,
    );
    expect(gl.generateMipmap).toHaveBeenCalledWith(gl.TEXTURE_2D);
    gl.generateMipmap.mockClear();
    api.createTexture(context, 2, 1, pixels, false);
    expect(gl.texParameteri).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR,
    );
    expect(gl.generateMipmap).not.toHaveBeenCalled();
  });

  it("binds owned persistent textures to integer sampler units without re-uploading", () => {
    const { gl, api, context, program } = fixture();
    const texture = api.createTexture(context, 1, 1, new Uint8Array(4), false);
    for (let i = 0; i < 2; i++) {
      api.drawTextured(
        context,
        program,
        [],
        [{ name: "opacity", values: new Float32Array([1]) }],
        4,
        0,
        3,
        [{ texture, name: "baseColor", unit: 3 }],
        undefined,
      );
    }
    expect(gl.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0 + 3);
    expect(gl.bindTexture).toHaveBeenLastCalledWith(
      gl.TEXTURE_2D,
      gl.createTexture.mock.results[0]!.value,
    );
    expect(gl.uniform1i).toHaveBeenCalledWith({ name: "baseColor" }, 3);
    expect(
      gl.getUniformLocation.mock.calls.filter(
        (call) => call[1] === "baseColor",
      ),
    ).toHaveLength(1);
    expect(gl.texImage2D).toHaveBeenCalledTimes(1);
    expect(gl.getParameter).toHaveBeenCalledTimes(2);
    expect(gl.drawArrays).toHaveBeenCalledTimes(2);
  });

  it("leaves the existing untextured draw contract unchanged", () => {
    const { gl, api, context, program } = fixture();
    api.draw(
      context,
      program,
      [],
      [],
      4,
      0,
      3,
      new Float32Array([0.1, 0.2, 0.3, 1]),
    );
    expect(gl.clear).toHaveBeenCalledWith(
      gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
    );
    expect(gl.drawArrays).toHaveBeenCalledWith(4, 0, 3);
    expect(gl.activeTexture).not.toHaveBeenCalled();
    expect(gl.getParameter).not.toHaveBeenCalled();
  });

  it("rejects malformed and oversized uploads before allocating GPU resources", () => {
    const { gl, api, context } = fixture();
    expect(() =>
      api.createTexture(context, 0, 1, new Uint8Array(), false),
    ).toThrow("positive integers");
    expect(() =>
      api.createTexture(context, 1.5, 1, new Uint8Array(4), false),
    ).toThrow("positive integers");
    expect(() =>
      api.createTexture(context, 4097, 1, new Uint8Array(), false),
    ).toThrow("WebGL limits");
    expect(() =>
      api.createTexture(context, 2, 2, new Uint8Array(15), false),
    ).toThrow("RGBA length");
    expect(gl.createTexture).not.toHaveBeenCalled();
  });

  it("rejects textures from another context and out-of-range sampler units", () => {
    const { gl, api, context, program, resources } = fixture();
    const otherContext = resources.add("webgl", { ...gl });
    const foreign = api.createTexture(
      otherContext,
      1,
      1,
      new Uint8Array(4),
      false,
    );
    expect(() =>
      api.drawTextured(
        context,
        program,
        [],
        [],
        4,
        0,
        3,
        [{ texture: foreign, name: "baseColor", unit: 0 }],
        undefined,
      ),
    ).toThrow("another context");
    const texture = api.createTexture(context, 1, 1, new Uint8Array(4), false);
    for (const unit of [-1, 0.5, 16]) {
      expect(() =>
        api.drawTextured(
          context,
          program,
          [],
          [],
          4,
          0,
          3,
          [{ texture, name: "baseColor", unit }],
          undefined,
        ),
      ).toThrow("texture unit");
    }
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });

  it("deletes textures on explicit destruction and instance disposal", () => {
    const { gl, api, context, program, controller } = fixture();
    const first = api.createTexture(context, 1, 1, new Uint8Array(4), false);
    api.createTexture(context, 1, 1, new Uint8Array(4), false);
    api.destroy(first);
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
    expect(() =>
      api.drawTextured(
        context,
        program,
        [],
        [],
        4,
        0,
        3,
        [{ texture: first, name: "baseColor", unit: 0 }],
        undefined,
      ),
    ).toThrow("Invalid gl-texture");
    controller.abort();
    expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
    expect(() =>
      api.createTexture(context, 1, 1, new Uint8Array(4), false),
    ).toThrow();
  });

  it("cleans up a failed upload instead of leaking an unregistered texture", () => {
    const { gl, api, context } = fixture();
    gl.texImage2D.mockImplementationOnce(() => {
      throw new Error("upload failed");
    });
    expect(() =>
      api.createTexture(context, 1, 1, new Uint8Array(4), false),
    ).toThrow("upload failed");
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
  });
});

describe("typed WebGL offscreen render targets", () => {
  it("allocates RGBA8 color and depth, preserving split framebuffer, renderbuffer and texture bindings", () => {
    const { gl, api, context } = fixture();
    const previous = { draw: {}, read: {}, depth: {}, texture: {} };
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, previous.draw);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous.read);
    gl.bindRenderbuffer(gl.RENDERBUFFER, previous.depth);
    gl.bindTexture(gl.TEXTURE_2D, previous.texture);
    const result = api.createRenderTarget(context, 1024, 512);
    expect(result.target).not.toBe(result.texture);
    expect(gl.texImage2D).toHaveBeenCalledWith(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1024,
      512,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    expect(gl.renderbufferStorage).toHaveBeenCalledExactlyOnceWith(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      1024,
      512,
    );
    expect(gl.framebufferTexture2D).toHaveBeenCalledWith(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      gl.createTexture.mock.results[0]!.value,
      0,
    );
    expect(gl.framebufferRenderbuffer).toHaveBeenCalledWith(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      gl.createRenderbuffer.mock.results[0]!.value,
    );
    expect(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)).toBe(previous.draw);
    expect(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)).toBe(previous.read);
    expect(gl.getParameter(gl.RENDERBUFFER_BINDING)).toBe(previous.depth);
    expect(gl.getParameter(gl.TEXTURE_BINDING_2D)).toBe(previous.texture);
    expect(gl.generateMipmap).not.toHaveBeenCalled();
  });

  it("draws and reads the selected target, then restores canvas dimensions and samples the retained color texture", () => {
    const { gl, api, context, program } = fixture();
    const result = api.createRenderTarget(context, 2048, 1024);
    api.bindRenderTarget(context, result.target);
    api.draw(context, program, [], [], 4, 0, 3, new Float32Array([1, 1, 1, 1]));
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 2048, 1024);
    expect(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)).toBe(
      gl.createFramebuffer.mock.results[0]!.value,
    );
    expect(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)).toBe(
      gl.createFramebuffer.mock.results[0]!.value,
    );
    expect(api.readPixels(context, 0, 0, 1, 1)).toHaveLength(4);
    api.bindRenderTarget(context, undefined);
    api.drawTextured(
      context,
      program,
      [],
      [],
      4,
      0,
      3,
      [{ texture: result.texture, name: "offscreen", unit: 2 }],
      undefined,
    );
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 960, 640);
    expect(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)).toBeNull();
    expect(gl.uniform1i).toHaveBeenCalledWith({ name: "offscreen" }, 2);
  });

  it("uses target dimensions for ordinary, textured and instanced draws without changing selection when another target is created", () => {
    const { gl, api, context, program } = fixture();
    const result = api.createRenderTarget(context, 512, 256);
    api.bindRenderTarget(context, result.target);
    api.createRenderTarget(context, 1024, 1024);
    api.drawInstanced(context, program, [], [], [], 4, 0, 3, 5, [], undefined);
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 512, 256);
    expect(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)).toBe(
      gl.createFramebuffer.mock.results[0]!.value,
    );
  });

  it("rejects invalid sizes and foreign or destroyed targets before binding them", () => {
    const { gl, api, context, resources } = fixture();
    for (const [width, height] of [
      [0, 1],
      [1, 0],
      [1.5, 2],
      [4097, 1],
    ])
      expect(() => api.createRenderTarget(context, width!, height!)).toThrow();
    expect(gl.createFramebuffer).not.toHaveBeenCalled();
    const result = api.createRenderTarget(context, 256, 256);
    const foreign = resources.add("webgl", { ...gl });
    expect(() => api.bindRenderTarget(foreign, result.target)).toThrow(
      "another context",
    );
    api.destroy(result.target);
    expect(() => api.bindRenderTarget(context, result.target)).toThrow(
      "Invalid gl-render-target",
    );
  });

  it("cleans up incomplete or failed allocations and preserves the previous bindings", () => {
    for (const failure of ["incomplete", "allocation", "driver"] as const) {
      const { gl, api, context } = fixture();
      const previous = {};
      gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
      if (failure === "incomplete")
        gl.checkFramebufferStatus.mockReturnValueOnce(36054);
      if (failure === "allocation")
        gl.createRenderbuffer.mockReturnValueOnce(null as never);
      if (failure === "driver") gl.getError.mockReturnValueOnce(1285);
      expect(() => api.createRenderTarget(context, 256, 256)).toThrow();
      expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(1);
      expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
      expect(gl.deleteRenderbuffer).toHaveBeenCalledTimes(
        failure === "allocation" ? 0 : 1,
      );
      expect(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)).toBe(previous);
      expect(gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)).toBe(previous);
    }
  });

  it("destroys target/depth independently from its color texture and unbinds released targets", () => {
    const { gl, api, context, program, controller } = fixture();
    const result = api.createRenderTarget(context, 512, 512);
    api.bindRenderTarget(context, result.target);
    api.destroy(result.target);
    expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(1);
    expect(gl.deleteRenderbuffer).toHaveBeenCalledTimes(1);
    expect(gl.deleteTexture).not.toHaveBeenCalled();
    api.drawTextured(
      context,
      program,
      [],
      [],
      4,
      0,
      3,
      [{ texture: result.texture, name: "offscreen", unit: 0 }],
      undefined,
    );
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 960, 640);
    api.destroy(result.texture);
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
    const second = api.createRenderTarget(context, 256, 256);
    api.bindRenderTarget(context, second.target);
    controller.abort();
    expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(2);
    expect(gl.deleteRenderbuffer).toHaveBeenCalledTimes(2);
    expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
  });

  it("unbinds a target if its separately owned color texture is destroyed first", () => {
    const { gl, api, context, program } = fixture();
    const result = api.createRenderTarget(context, 512, 512);
    api.bindRenderTarget(context, result.target);
    api.destroy(result.texture);
    api.draw(context, program, [], [], 4, 0, 3, undefined);
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 960, 640);
    expect(() => api.bindRenderTarget(context, result.target)).toThrow(
      "Invalid gl-texture",
    );
    api.destroy(result.target);
  });
});
