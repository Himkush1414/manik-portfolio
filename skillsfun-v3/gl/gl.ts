// Small hand-written WebGL2 toolkit shared by the neon tube and the black
// hole: fullscreen-triangle programs, HDR render targets, a mip-chain bloom
// (13-tap downsample + tent upsample) and one composite pass that tonemaps,
// adds the bloom, optionally inverts (light mode) and dithers/grains.

export type GL = WebGL2RenderingContext

export function createContext(canvas: HTMLCanvasElement): GL | null {
  return canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  })
}

// attribute-less fullscreen triangle (draw with drawArrays(TRIANGLES, 0, 3))
export const FULLSCREEN_VS = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`

function compileShader(gl: GL, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`shader compile failed: ${log}`)
  }
  return sh
}

export class Program {
  readonly program: WebGLProgram
  private locs = new Map<string, WebGLUniformLocation | null>()
  private gl: GL

  constructor(gl: GL, fs: string, vs = FULLSCREEN_VS) {
    this.gl = gl
    const p = gl.createProgram()!
    const v = compileShader(gl, gl.VERTEX_SHADER, vs)
    const f = compileShader(gl, gl.FRAGMENT_SHADER, fs)
    gl.attachShader(p, v)
    gl.attachShader(p, f)
    gl.linkProgram(p)
    gl.deleteShader(v)
    gl.deleteShader(f)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link failed: ${gl.getProgramInfoLog(p)}`)
    this.program = p
  }

  use() {
    this.gl.useProgram(this.program)
    return this
  }

  loc(name: string) {
    if (!this.locs.has(name)) this.locs.set(name, this.gl.getUniformLocation(this.program, name))
    return this.locs.get(name)!
  }

  f(name: string, ...v: number[]) {
    const l = this.loc(name)
    if (!l) return this
    const gl = this.gl
    if (v.length === 1) gl.uniform1f(l, v[0])
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1])
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2])
    else gl.uniform4f(l, v[0], v[1], v[2], v[3])
    return this
  }

  i(name: string, v: number) {
    const l = this.loc(name)
    if (l) this.gl.uniform1i(l, v)
    return this
  }

  v4(name: string, data: Float32Array) {
    const l = this.loc(name)
    if (l) this.gl.uniform4fv(l, data)
    return this
  }

  tex(name: string, unit: number, tex: WebGLTexture) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    return this.i(name, unit)
  }

  dispose() {
    this.gl.deleteProgram(this.program)
  }
}

export interface Target {
  fb: WebGLFramebuffer
  tex: WebGLTexture
  w: number
  h: number
}

export function supportsHalfFloatTargets(gl: GL) {
  return !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')
}

export function createTarget(gl: GL, w: number, h: number, hdr: boolean): Target {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const fb = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { fb, tex, w, h }
}

export function deleteTarget(gl: GL, t: Target | null) {
  if (!t) return
  gl.deleteFramebuffer(t.fb)
  gl.deleteTexture(t.tex)
}

export function bindTarget(gl: GL, t: Target | null, cw = 0, ch = 0) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null)
  gl.viewport(0, 0, t ? t.w : cw, t ? t.h : ch)
}

export function drawFullscreen(gl: GL) {
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

const PREFILTER_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
out vec4 o;
// the scene's alpha is a bloom weight (lettering feeds only a little of it)
vec3 s(vec2 off) { vec4 t = texture(uSrc, vUv + off * uTexel); return t.rgb * t.a; }
void main() {
  // 13-tap box/tent downsample (stable, no fireflies)
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  float br = max(col.r, max(col.g, col.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-5);
  float w = max(rq, br - uThreshold) / max(br, 1e-5);
  o = vec4(col * w, 1.0);
}`

const DOWN_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 o;
vec3 s(vec2 off) { return texture(uSrc, vUv + off * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  o = vec4(e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125, 1.0);
}`

const UP_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uRadius;
out vec4 o;
vec3 s(vec2 off) { return texture(uSrc, vUv + off * uTexel * uRadius).rgb; }
void main() {
  vec3 col = s(vec2(0)) * 4.0;
  col += (s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1)) + s(vec2(0, 1))) * 2.0;
  col += s(vec2(-1, -1)) + s(vec2(1, -1)) + s(vec2(-1, 1)) + s(vec2(1, 1));
  o = vec4(col / 16.0, 1.0);
}`

export class Bloom {
  private gl: GL
  private hdr: boolean
  private levels: Target[] = []
  private pre: Program
  private down: Program
  private up: Program

  constructor(gl: GL, hdr: boolean) {
    this.gl = gl
    this.hdr = hdr
    this.pre = new Program(gl, PREFILTER_FS)
    this.down = new Program(gl, DOWN_FS)
    this.up = new Program(gl, UP_FS)
  }

  resize(w: number, h: number, maxLevels = 6) {
    const gl = this.gl
    this.levels.forEach(t => deleteTarget(gl, t))
    this.levels = []
    let lw = Math.max(1, w >> 1)
    let lh = Math.max(1, h >> 1)
    for (let i = 0; i < maxLevels && lw >= 4 && lh >= 4; i++) {
      this.levels.push(createTarget(gl, lw, lh, this.hdr))
      lw >>= 1
      lh >>= 1
    }
  }

  /** returns the half-res bloom texture */
  run(src: Target, threshold: number, knee: number, radius = 1) {
    const gl = this.gl
    const L = this.levels
    gl.disable(gl.BLEND)
    bindTarget(gl, L[0])
    this.pre.use().tex('uSrc', 0, src.tex).f('uTexel', 1 / src.w, 1 / src.h).f('uThreshold', threshold).f('uKnee', knee)
    drawFullscreen(gl)
    this.down.use()
    for (let i = 1; i < L.length; i++) {
      bindTarget(gl, L[i])
      this.down.tex('uSrc', 0, L[i - 1].tex).f('uTexel', 1 / L[i - 1].w, 1 / L[i - 1].h)
      drawFullscreen(gl)
    }
    // progressive additive upsample back to level 0
    this.up.use().f('uRadius', radius)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    for (let i = L.length - 1; i > 0; i--) {
      bindTarget(gl, L[i - 1])
      this.up.tex('uSrc', 0, L[i].tex).f('uTexel', 1 / L[i].w, 1 / L[i].h)
      drawFullscreen(gl)
    }
    gl.disable(gl.BLEND)
    return L[0]
  }

  dispose() {
    this.levels.forEach(t => deleteTarget(this.gl, t))
    this.pre.dispose()
    this.down.dispose()
    this.up.dispose()
  }
}

// scene (linear light) + bloom -> tonemap -> sRGB, with film grain and a
// triangular-PDF dither so long soft gradients never band in any color.
//
// The tonemap is chroma-preserving: the curve is applied to the brightest
// channel only and the linear color ratios are kept, so a red spill stays red
// instead of washing to white/gray. For neutral light it is exactly the
// previous curve (bg + (1 - bg) * (1 - e^-x) in display space).
// uBaseTint is the dark base's chroma, normalised to keep its luminance, so a
// neutral backlight leaves the base untouched.
export const GLSL_SRGB = /* glsl */ `
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
float toLinear1(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
`

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uBg;        // base level, display value
uniform vec3 uBaseTint;   // base chroma, luminance-normalised (1,1,1 = neutral)
uniform float uGrain;
uniform float uTime;
uniform float uFade;
out vec4 o;
${GLSL_NOISE}
${GLSL_SRGB}
void main() {
  vec3 light = max(texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomStrength, 0.0);
  float m = max(light.r, max(light.g, light.b));
  vec3 ratio = m > 1e-5 ? light / m : vec3(1.0);
  float d = uBg + (1.0 - uBg) * (1.0 - exp(-m * uExposure));     // old curve, on the peak channel
  float bgLin = toLinear1(uBg);
  vec3 base = bgLin * uBaseTint;
  vec3 lin = base + (toLinear1(d) - bgLin) * ratio * uFade;
  vec3 col = toSrgb(lin);
  vec2 fc = gl_FragCoord.xy;
  float t = floor(uTime * 24.0);
  float g = hash12(fc + t * 17.13) - 0.5;
  float lum = dot(col, vec3(0.333));
  // grain sits mostly in the mid-tones, like film
  col += g * uGrain * (0.35 + 0.65 * (1.0 - abs(lum * 2.0 - 1.0)));
  float dth = hash12(fc * 1.37 + t) + hash12(fc * 0.71 - t) - 1.0;
  col += dth / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

export function capDpr(mobile: boolean) {
  return Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
}

export function isMobileViewport() {
  return window.matchMedia('(max-width: 760px), (pointer: coarse)').matches
}

export function loseContext(gl: GL | null) {
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
}
