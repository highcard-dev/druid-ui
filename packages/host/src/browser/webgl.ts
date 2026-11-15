import type { BrowserImports } from "@druid-ui/client/types";
import { dimensions, Resources } from "./resources";
import type { Surfaces } from "./surfaces";

type Owned<T> = { gl: WebGL2RenderingContext; value: T };
type Program = {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
};
type TextureBinding = { texture: number; name: string; unit: number };
type RenderTarget = {
  framebuffer: WebGLFramebuffer;
  depth: WebGLRenderbuffer;
  texture: number;
  width: number;
  height: number;
};
export function webgl(
  surfaces: Surfaces,
  resources: Resources,
): BrowserImports["druid:openui/webgl"] {
  const targets = new WeakMap<WebGL2RenderingContext, RenderTarget>();
  const unbind = (gl: WebGL2RenderingContext, target: RenderTarget) => {
    if (targets.get(gl) === target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      targets.delete(gl);
    }
  };
  const textureLimits = new WeakMap<
    WebGL2RenderingContext,
    { size: number; units: number }
  >();
  const limits = (gl: WebGL2RenderingContext) => {
    let value = textureLimits.get(gl);
    if (!value) {
      value = {
        size: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        units: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      };
      textureLimits.set(gl, value);
    }
    return value;
  };
  const context = (id: number) => {
    const gl = resources.get<WebGL2RenderingContext>(id, "webgl");
    if (gl.isContextLost()) throw new Error("WebGL context lost");
    return gl;
  };
  const owned = <T>(id: number, kind: string, gl: WebGL2RenderingContext) => {
    const object = resources.get<Owned<T>>(id, kind);
    if (object.gl !== gl)
      throw new Error("WebGL object belongs to another context");
    return object.value;
  };
  const draw = (
    [id, program, attributes, uniforms, mode, first, count, clear]: Parameters<
      BrowserImports["druid:openui/webgl"]["draw"]
    >,
    textures: TextureBinding[] = [],
    instanceAttributes: Parameters<
      BrowserImports["druid:openui/webgl"]["draw"]
    >[2] = [],
    instances?: number,
  ) => {
    const gl = context(id);
    const p = owned<Program>(program, "gl-program", gl);
    const target = targets.get(gl);
    gl.viewport(
      0,
      0,
      target?.width ?? gl.drawingBufferWidth,
      target?.height ?? gl.drawingBufferHeight,
    );
    if (clear) {
      if (clear.length !== 4) throw new Error("Clear color needs four values");
      gl.clearColor(clear[0]!, clear[1]!, clear[2]!, clear[3]!);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    gl.useProgram(p.program);
    const bindAttribute = (a: (typeof attributes)[number]) => {
      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        owned<WebGLBuffer>(a.buffer, "gl-buffer", gl),
      );
      gl.enableVertexAttribArray(a.location);
      gl.vertexAttribPointer(
        a.location,
        a.components,
        gl.FLOAT,
        false,
        a.stride,
        a.offset,
      );
    };
    for (const a of attributes) bindAttribute(a);
    const location = (name: string) => {
      if (!p.uniforms.has(name))
        p.uniforms.set(name, gl.getUniformLocation(p.program, name));
      return p.uniforms.get(name)!;
    };
    for (const u of uniforms) {
      const loc = location(u.name);
      switch (u.values.length) {
        case 1:
          gl.uniform1fv(loc, u.values);
          break;
        case 2:
          gl.uniform2fv(loc, u.values);
          break;
        case 3:
          gl.uniform3fv(loc, u.values);
          break;
        case 4:
          gl.uniform4fv(loc, u.values);
          break;
        case 16:
          gl.uniformMatrix4fv(loc, false, u.values);
          break;
        default:
          if (u.values.length > 16 && u.values.length % 16 === 0) {
            gl.uniformMatrix4fv(loc, false, u.values);
            break;
          }
          throw new Error(
            "Uniform needs 1, 2, 3, 4 floats or complete mat4 matrices",
          );
      }
    }
    const maxUnits = textures.length ? limits(gl).units : 0;
    for (const binding of textures) {
      const texture = owned<WebGLTexture>(binding.texture, "gl-texture", gl);
      if (
        !Number.isInteger(binding.unit) ||
        binding.unit < 0 ||
        binding.unit >= maxUnits
      )
        throw new Error("Invalid WebGL texture unit");
      gl.activeTexture(gl.TEXTURE0 + binding.unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(location(binding.name), binding.unit);
    }
    try {
      for (const a of instanceAttributes) {
        bindAttribute(a);
        gl.vertexAttribDivisor(a.location, 1);
      }
      if (instances === undefined) gl.drawArrays(mode, first, count);
      else gl.drawArraysInstanced(mode, first, count, instances);
    } finally {
      for (const a of instanceAttributes) {
        gl.vertexAttribDivisor(a.location, 0);
        gl.disableVertexAttribArray(a.location);
      }
      for (const a of attributes) gl.disableVertexAttribArray(a.location);
    }
  };
  return {
    open(surface) {
      const gl = surfaces.getCanvas(surface).getContext("webgl2");
      if (!gl)
        throw new Error(
          "WebGL2 unavailable or surface already uses another context",
        );
      return resources.add("webgl", gl, () =>
        gl.getExtension("WEBGL_lose_context")?.loseContext(),
      );
    },
    depthTest(id, enabled) {
      const gl = context(id);
      if (enabled) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);
    },
    depthMask(id, enabled) {
      context(id).depthMask(enabled);
    },
    blend(id, enabled) {
      const gl = context(id);
      if (enabled) {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
      } else gl.disable(gl.BLEND);
    },
    createProgram(id, vertex, fragment) {
      const gl = context(id);
      const shaders: WebGLShader[] = [];
      const program = gl.createProgram();
      if (!program) throw new Error("Cannot allocate WebGL program");
      try {
        for (const [type, source] of [
          [gl.VERTEX_SHADER, vertex],
          [gl.FRAGMENT_SHADER, fragment],
        ] as const) {
          const shader = gl.createShader(type);
          if (!shader) throw new Error("Cannot allocate shader");
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw new Error(
              gl.getShaderInfoLog(shader) ?? "Shader compilation failed",
            );
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw new Error(
            gl.getProgramInfoLog(program) ?? "Shader link failed",
          );
        const uniforms = new Map<string, WebGLUniformLocation | null>();
        return resources.add(
          "gl-program",
          { gl, value: { program, uniforms } },
          () => gl.deleteProgram(program),
        );
      } catch (error) {
        gl.deleteProgram(program);
        throw error;
      } finally {
        for (const shader of shaders) gl.deleteShader(shader);
      }
    },
    createBuffer(id, data, dynamic) {
      const gl = context(id),
        buffer = gl.createBuffer();
      if (!buffer) throw new Error("Cannot allocate WebGL buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        data,
        dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW,
      );
      return resources.add("gl-buffer", { gl, value: buffer }, () =>
        gl.deleteBuffer(buffer),
      );
    },
    writeBuffer(id, offset, data) {
      const { gl, value } = resources.get<Owned<WebGLBuffer>>(id, "gl-buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, value);
      gl.bufferSubData(gl.ARRAY_BUFFER, offset, data);
    },
    createTexture(id, width, height, pixels, mipmaps) {
      const gl = context(id);
      dimensions(width, height);
      if (width > limits(gl).size || height > limits(gl).size)
        throw new Error("Texture dimensions exceed WebGL limits");
      if (pixels.byteLength !== width * height * 4)
        throw new Error("RGBA length must equal width × height × 4");
      const texture = gl.createTexture();
      if (!texture) throw new Error("Cannot allocate WebGL texture");
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          width,
          height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
        return resources.add("gl-texture", { gl, value: texture }, () =>
          gl.deleteTexture(texture),
        );
      } catch (error) {
        gl.deleteTexture(texture);
        throw error;
      }
    },
    createRenderTarget(id, width, height) {
      const gl = context(id);
      dimensions(width, height);
      const maxSize = Math.min(
        limits(gl).size,
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      );
      if (width > maxSize || height > maxSize)
        throw new Error("Render target dimensions exceed WebGL limits");
      const previousDraw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
      const previousRead = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      const previousDepth = gl.getParameter(gl.RENDERBUFFER_BINDING);
      const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
      const texture = gl.createTexture();
      const framebuffer = gl.createFramebuffer();
      const depth = gl.createRenderbuffer();
      try {
        if (!texture || !framebuffer || !depth)
          throw new Error("Cannot allocate WebGL render target");
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA8,
          width,
          height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorage(
          gl.RENDERBUFFER,
          gl.DEPTH_COMPONENT16,
          width,
          height,
        );
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0,
        );
        gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.RENDERBUFFER,
          depth,
        );
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
          throw new Error(`Incomplete WebGL render target: ${status}`);
        const error = gl.getError();
        if (error !== gl.NO_ERROR)
          throw new Error(`WebGL render target allocation failed: ${error}`);
      } catch (error) {
        if (framebuffer) gl.deleteFramebuffer(framebuffer);
        if (depth) gl.deleteRenderbuffer(depth);
        if (texture) gl.deleteTexture(texture);
        throw error;
      } finally {
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, previousDraw);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousRead);
        gl.bindRenderbuffer(gl.RENDERBUFFER, previousDepth);
        gl.bindTexture(gl.TEXTURE_2D, previousTexture);
      }
      const value: RenderTarget = {
        framebuffer,
        depth,
        width,
        height,
        texture: 0,
      };
      value.texture = resources.add(
        "gl-texture",
        { gl, value: texture },
        () => {
          unbind(gl, value);
          gl.deleteTexture(texture);
        },
      );
      const target = resources.add("gl-render-target", { gl, value }, () => {
        unbind(gl, value);
        gl.deleteFramebuffer(framebuffer);
        gl.deleteRenderbuffer(depth);
      });
      return { target, texture: value.texture };
    },
    bindRenderTarget(id, target) {
      const gl = context(id);
      if (target === undefined) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        targets.delete(gl);
      } else {
        const value = owned<RenderTarget>(target, "gl-render-target", gl);
        owned<WebGLTexture>(value.texture, "gl-texture", gl);
        gl.bindFramebuffer(gl.FRAMEBUFFER, value.framebuffer);
        targets.set(gl, value);
      }
    },
    draw: (...args) => draw(args),
    drawTextured(
      id,
      program,
      attributes,
      uniforms,
      mode,
      first,
      count,
      textures,
      clear,
    ) {
      draw(
        [id, program, attributes, uniforms, mode, first, count, clear],
        textures,
      );
    },
    drawInstanced(
      id,
      program,
      attributes,
      instanceAttributes,
      uniforms,
      mode,
      first,
      count,
      instances,
      textures,
      clear,
    ) {
      draw(
        [id, program, attributes, uniforms, mode, first, count, clear],
        textures,
        instanceAttributes,
        instances,
      );
    },
    readPixels(id, x, y, width, height) {
      const gl = context(id),
        bytes = new Uint8Array(width * height * 4);
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      return bytes;
    },
    destroy: (id) => resources.remove(id),
  };
}
