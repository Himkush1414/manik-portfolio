import {
  GLSL_NOISE,
  GLSL_SRGB,
  Program,
  bindTarget,
  createContext,
  createTarget,
  deleteTarget,
  drawFullscreen,
  supportsHalfFloatTargets,
  type GL,
  type Target,
} from '../gl/gl'
import type { RGB } from '../effects/neon/colors'

// "Rising lines": shooting stars flying UP out of a glowing horizon.
// WebGL2, everything in linear light into a half-float target:
//   1. background: matte near-black, slow low-frequency fog (tinted by the
//      tube near the horizon, <= 9%), the horizon line + its wide glow
//   2. lines: instanced quads, additive; white-hot head -> tube -> backlight
//      tail; three depth layers (far = thinner, dimmer, hazier, higher start)
//   3. sparks: instanced points drifting up
//   4. composite: chroma-preserving tonemap -> sRGB, vignette, grain, dither
// The simulation (pooled, fixed arrays) lives in RisingLines.step().

export const HORIZON = 0.12 // horizon height, fraction of the footer from the bottom

const BG_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;       // css px
uniform float uScale;
uniform float uTime;
uniform float uOpen;     // horizon opening 0..1 (from the centre out)
uniform vec3 uTube;      // linear light colors
uniform vec3 uBack;
uniform vec3 uPtr;       // pointer x (css px), y (css px from bottom), strength
uniform float uGlow;     // horizon glow strength
out vec4 o;
${GLSL_NOISE}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main() {
  vec2 px = gl_FragCoord.xy / uScale;               // y up, from the bottom
  float W = uRes.x, H = uRes.y;
  float hy = H * ${HORIZON.toFixed(3)};
  float dy = px.y - hy;
  float ax = abs(px.x - W * 0.5) / (W * 0.5);       // 0 centre .. 1 edge
  // matte base + slow drifting low-frequency fog
  vec2 fq = vec2(px.x / W * 2.2, px.y / H * 1.6);
  float fog = fbm(fq + vec2(uTime * 0.012, -uTime * 0.02));
  fog = smoothstep(0.25, 0.85, fog);
  float nearH = exp(-max(dy, 0.0) / (H * 0.35));
  vec3 fogCol = mix(vec3(1.0), uTube / max(max(uTube.r, max(uTube.g, uTube.b)), 1e-3), 0.09 * nearH);
  vec3 col = vec3(0.0021) + fogCol * fog * (0.010 + 0.016 * nearH);
  // the horizon opens from the centre outward
  float open = smoothstep(uOpen + 0.04, uOpen - 0.04, ax);
  float edge = 1.0 - smoothstep(0.55, 1.0, ax);      // fades toward the edges
  float ptrK = uPtr.z * exp(-pow((px.x - uPtr.x) / 220.0, 2.0));
  float line = exp(-pow(dy / 0.9, 2.0)) * 2.4;
  float glowUp = exp(-max(dy, 0.0) / (H * 0.07)) * 0.38 + exp(-max(dy, 0.0) / (H * 0.22)) * 0.1;
  float glowDn = exp(min(dy, 0.0) / (H * 0.025)) * 0.32;
  float g = (line + (dy > 0.0 ? glowUp : glowDn)) * edge * open * uGlow * (1.0 + 0.6 * ptrK);
  col += mix(uTube, vec3(1.0), 0.25 * exp(-pow(dy / 0.9, 2.0))) * g;
  // faint haze above the horizon, in the backlight color (the far layer lives in it)
  col += uBack * exp(-max(dy, 0.0) / (H * 0.3)) * 0.018 * open * edge * step(0.0, dy);
  o = vec4(col, 1.0);
}`

const LINE_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aCorner;   // x: -1..1 across, y: 0 (tail end) .. 1 (head end)
layout(location = 1) in vec4 aA;        // x, yHead, yTail, width (css px, y up)
layout(location = 2) in vec4 aB;        // brightness, depth, fade, -
uniform vec2 uRes;
out vec2 vLocal;     // across (px), down from the head (px)
out float vLen;
out float vW;
out vec3 vB;
void main() {
  float w = aA.w;
  float margin = w * 5.0 + 2.0;
  float x = aA.x + aCorner.x * margin;
  float y = mix(aA.z, aA.y + margin, aCorner.y);
  vLocal = vec2(x - aA.x, aA.y - y);
  vLen = max(aA.y - aA.z, 1.0);
  vW = w;
  vB = aB.xyz;
  gl_Position = vec4(x / uRes.x * 2.0 - 1.0, y / uRes.y * 2.0 - 1.0, 0.0, 1.0);
}`

const LINE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
in float vLen;
in float vW;
in vec3 vB;
uniform vec3 uTube;
uniform vec3 uBack;
out vec4 o;
void main() {
  float u = vLocal.x;
  float v = vLocal.y;                      // > 0 below the head
  float s = clamp(v / vLen, 0.0, 1.0);     // 0 head .. 1 tail end
  float depth = vB.y;
  float w = vW;
  // far lines are softer (they sit in the haze)
  float soft = mix(1.8, 1.0, depth);
  float core = exp(-pow(u / (w * 0.55 * soft), 2.0));
  float halo = exp(-pow(u / (w * 3.2 * soft), 2.0)) * 0.22;
  float along = v < 0.0 ? 0.0 : pow(1.0 - s, 2.3);
  float head = exp(-pow(length(vec2(u, v)) / (w * 1.5), 2.0)) * 2.2 + exp(-length(vec2(u, v)) / (w * 4.0)) * 0.18;
  // white-hot head -> line (tube) color -> tail (backlight) color
  vec3 col = mix(vec3(1.0), uTube, smoothstep(0.0, 0.1, s));
  col = mix(col, uBack, smoothstep(0.3, 0.95, s));
  vec3 headCol = mix(vec3(1.0), uTube, 0.25);
  vec3 light = col * (core + halo) * along + headCol * head;
  o = vec4(light * vB.x * vB.z, 1.0);
}`

const SPARK_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aS;   // x, y (css px, up), size (css px), alpha
uniform vec2 uRes;
uniform float uScale;
out float vA;
void main() {
  gl_PointSize = max(1.0, aS.z * uScale * 4.0);
  vA = aS.w;
  gl_Position = vec4(aS.x / uRes.x * 2.0 - 1.0, aS.y / uRes.y * 2.0 - 1.0, 0.0, 1.0);
}`

const SPARK_FS = /* glsl */ `#version 300 es
precision highp float;
in float vA;
uniform vec3 uTube;
uniform vec3 uBack;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 4.0;     // ~1 at the dot's edge
  float k = exp(-d * d * 1.6) + exp(-d * 1.2) * 0.08;
  o = vec4(mix(uTube, uBack, 0.4) * k * vA, 1.0);
}`

const COMP_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform float uTime;
uniform float uExposure;
out vec4 o;
${GLSL_NOISE}
${GLSL_SRGB}
void main() {
  vec3 L = max(texture(uScene, vUv).rgb, 0.0);
  // vignette, in light
  vec2 q = vUv - 0.5;
  L *= 1.0 - 0.45 * smoothstep(0.25, 0.85, length(q * vec2(1.0, 1.3)));
  float m = max(L.r, max(L.g, L.b));
  vec3 ratio = m > 1e-6 ? L / m : vec3(1.0);
  float mapped = 1.0 - exp(-m * uExposure);
  vec3 col = toSrgb(ratio * toLinear1(mapped));
  vec2 fc = gl_FragCoord.xy;
  float t = floor(uTime * 24.0);
  col += (hash12(fc + t * 17.13) - 0.5) * 0.028;                       // fine film grain
  col += (hash12(fc * 1.37 + t) + hash12(fc * 0.71 - t) - 1.0) / 255.0; // dither
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

interface Line {
  x: number
  y: number
  y0: number
  v: number
  len: number
  w: number
  b: number
  d: number
  alive: boolean
  volley: boolean
}
interface Spark {
  x: number
  y: number
  v: number
  s: number
  a: number
  ph: number
  alive: boolean
}

export interface RisingOptions {
  mobile: boolean
  reduced: boolean
}

export interface RisingLook {
  tube: RGB // linear light colors
  back: RGB
}

export class RisingLines {
  readonly gl: GL
  private bg: Program
  private lineP: Program
  private sparkP: Program
  private comp: Program
  private scene: Target | null = null
  private hdr: boolean
  private lineVao: WebGLVertexArrayObject
  private lineBuf: WebGLBuffer
  private sparkVao: WebGLVertexArrayObject
  private sparkBuf: WebGLBuffer
  private lineData: Float32Array
  private sparkData: Float32Array
  private lines: Line[]
  private sparks: Spark[]
  private density: number
  private sparkCount: number
  private spawnAcc = 0
  private colAcc = 0
  W = 1
  H = 1
  scale = 1
  time = 0
  open = 0 // horizon opening (driven by the component's intro)
  ptrX = -1 // eased pointer x, css px (-1 = none)
  ptrK = 0 // eased pointer strength 0..1
  private reduced: boolean

  static create(canvas: HTMLCanvasElement, o: RisingOptions) {
    const gl = createContext(canvas)
    return gl ? new RisingLines(gl, o) : null
  }

  private constructor(gl: GL, o: RisingOptions) {
    this.gl = gl
    this.reduced = o.reduced
    this.hdr = supportsHalfFloatTargets(gl)
    this.bg = new Program(gl, BG_FS)
    this.lineP = new Program(gl, LINE_FS, LINE_VS)
    this.sparkP = new Program(gl, SPARK_FS, SPARK_VS)
    this.comp = new Program(gl, COMP_FS)
    this.density = o.mobile ? 70 : 140
    this.sparkCount = o.mobile ? 110 : 220
    const maxLines = this.density * 2 + 160 // ambient + updraft + volley cap
    this.lines = Array.from({ length: maxLines }, () => ({ x: 0, y: 0, y0: 0, v: 0, len: 0, w: 1, b: 1, d: 1, alive: false, volley: false }))
    this.sparks = Array.from({ length: this.sparkCount * 2 }, () => ({ x: 0, y: 0, v: 0, s: 1, a: 1, ph: 0, alive: false }))
    this.lineData = new Float32Array(maxLines * 8)
    this.sparkData = new Float32Array(this.sparks.length * 4)

    // quad corners (triangle strip) + per-instance attributes
    const corners = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, corners)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), gl.STATIC_DRAW)
    this.lineVao = gl.createVertexArray()!
    gl.bindVertexArray(this.lineVao)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.lineBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf)
    gl.bufferData(gl.ARRAY_BUFFER, this.lineData.byteLength, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16)
    gl.vertexAttribDivisor(2, 1)
    this.sparkVao = gl.createVertexArray()!
    gl.bindVertexArray(this.sparkVao)
    this.sparkBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sparkBuf)
    gl.bufferData(gl.ARRAY_BUFFER, this.sparkData.byteLength, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
  }

  resize(W: number, H: number, scale: number) {
    const gl = this.gl
    this.W = Math.max(1, W)
    this.H = Math.max(1, H)
    this.scale = scale
    const c = gl.canvas as HTMLCanvasElement
    c.width = Math.round(this.W * scale)
    c.height = Math.round(this.H * scale)
    deleteTarget(gl, this.scene)
    this.scene = createTarget(gl, c.width, c.height, this.hdr)
  }

  get horizonY() {
    return this.H * HORIZON
  }

  private spawnLine(x: number, opts: { volley?: boolean; near?: boolean } = {}) {
    const l = this.lines.find(l => !l.alive)
    if (!l) return
    const H = this.H
    const r = Math.random()
    // three depth layers: far 45%, mid 35%, near 20%
    const d = opts.near ? 1 : r < 0.45 ? 0.35 : r < 0.8 ? 0.65 : 1
    l.alive = true
    l.volley = !!opts.volley
    l.d = d
    l.x = x
    l.y0 = this.horizonY + (1 - d) * H * 0.07 // distant lines start a little above the horizon
    l.y = l.y0
    l.v = H * (0.22 + 0.36 * d) * (0.75 + Math.random() * 0.5) * (opts.volley ? 1.35 : 1)
    l.len = H * (0.3 + Math.random() * 0.4) * (0.55 + 0.45 * d)
    l.w = d < 0.5 ? 0.8 : d < 0.9 ? 1 : 1.5
    l.b = (0.28 + 0.72 * d) * (0.7 + Math.random() * 0.45) * (opts.volley ? 1.25 : 1)
  }

  private spawnSpark(x?: number) {
    const s = this.sparks.find(s => !s.alive)
    if (!s) return
    s.alive = true
    s.x = x ?? Math.random() * this.W
    s.y = this.horizonY + Math.random() * this.H * 0.15
    s.v = this.H * (0.03 + Math.random() * 0.08)
    s.s = 0.4 + Math.random() * 0.6
    s.a = 0.25 + Math.random() * 0.6
    s.ph = Math.random() * 6.28
  }

  /** click / tap: ~30 lines from the horizon around x (volleys stack, capped) */
  volley(x: number) {
    if (this.reduced) return
    const active = this.lines.reduce((n, l) => n + (l.alive && l.volley ? 1 : 0), 0)
    const n = Math.min(30, 150 - active)
    for (let i = 0; i < n; i++) {
      const g = (Math.random() + Math.random() + Math.random() - 1.5) * 34
      this.spawnLine(x + g, { volley: true, near: Math.random() < 0.6 })
    }
  }

  /** pre-run the simulation (reduced motion still frame, or a warm start) */
  warm(seconds: number) {
    for (let t = 0; t < seconds; t += 1 / 30) this.step(1 / 30, true)
  }

  step(dt: number, force = false) {
    if (this.reduced && !force) return
    this.time += dt
    const W = this.W
    const H = this.H
    const cx = W / 2
    const span = this.open * W * 0.5
    // ambient spawning keeps ~density lines alive (only where the horizon is open)
    const avgLife = (H * 0.85) / (H * 0.43)
    // lines begin rising in once the horizon has mostly opened
    this.spawnAcc += (this.density / avgLife) * dt * smooth(0.55, 1, this.open)
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1
      this.spawnLine(cx + (Math.random() * 2 - 1) * span)
    }
    // updraft column under the pointer: denser + faster
    if (this.ptrK > 0.02 && this.ptrX >= 0) {
      this.colAcc += 34 * this.ptrK * dt
      while (this.colAcc >= 1) {
        this.colAcc -= 1
        this.spawnLine(this.ptrX + (Math.random() * 2 - 1) * 70)
        if (Math.random() < 0.7) this.spawnSpark(this.ptrX + (Math.random() * 2 - 1) * 80)
      }
    }
    const ambientSparks = this.sparkCount * this.open
    let liveSparks = 0
    for (const s of this.sparks) if (s.alive) liveSparks++
    for (let i = liveSparks; i < ambientSparks && Math.random() < 0.5; i++) this.spawnSpark(cx + (Math.random() * 2 - 1) * span)

    const top = H * 1.02
    for (const l of this.lines) {
      if (!l.alive) continue
      const k = this.updraft(l.x)
      l.y += l.v * (1 + 1.3 * k) * dt
      if (l.y - l.len * 0.5 > top) l.alive = false
    }
    for (const s of this.sparks) {
      if (!s.alive) continue
      s.y += s.v * (1 + 1.6 * this.updraft(s.x)) * dt
      s.x += Math.sin(this.time * 1.3 + s.ph) * 6 * dt
      if (s.y > H * 0.95) s.alive = false
    }
  }

  private updraft(x: number) {
    if (this.ptrK <= 0.001 || this.ptrX < 0) return 0
    const d = (x - this.ptrX) / 80
    return this.ptrK * Math.exp(-d * d)
  }

  render(look: RisingLook, glowGain = 1) {
    const gl = this.gl
    const c = gl.canvas as HTMLCanvasElement
    const H = this.H
    // pack instances
    let n = 0
    for (const l of this.lines) {
      if (!l.alive) continue
      const rise = Math.max(0, (l.y - l.y0) / H)
      // lines fly up through the content and thin out / fade just before the top
      const fade = (1 - smooth(0.66, 0.97, l.y / H)) * smooth(0, 0.04, rise)
      if (fade <= 0.001) continue
      const o = n * 8
      this.lineData[o] = l.x
      this.lineData[o + 1] = l.y
      this.lineData[o + 2] = Math.max(l.y0, l.y - l.len)
      this.lineData[o + 3] = l.w * (1 - 0.45 * Math.min(1, rise * 1.4)) // thins out as it rises
      this.lineData[o + 4] = l.b
      this.lineData[o + 5] = l.d
      this.lineData[o + 6] = fade
      n++
    }
    let ns = 0
    for (const s of this.sparks) {
      if (!s.alive) continue
      const o = ns * 4
      const f = 1 - smooth(0.55, 0.95, s.y / H)
      this.sparkData[o] = s.x
      this.sparkData[o + 1] = s.y
      this.sparkData[o + 2] = s.s
      this.sparkData[o + 3] = s.a * f * (0.6 + 0.4 * Math.sin(this.time * 3 + s.ph))
      ns++
    }

    bindTarget(gl, this.scene)
    gl.disable(gl.BLEND)
    this.bg
      .use()
      .f('uRes', this.W, H)
      .f('uScale', this.scale)
      .f('uTime', this.time)
      .f('uOpen', this.open)
      .f('uTube', ...look.tube)
      .f('uBack', ...look.back)
      .f('uPtr', this.ptrX, 0, this.ptrK)
      .f('uGlow', glowGain)
    drawFullscreen(gl)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    if (n) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lineData, 0, n * 8)
      this.lineP.use().f('uRes', this.W, H).f('uTube', ...look.tube).f('uBack', ...look.back)
      gl.bindVertexArray(this.lineVao)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n)
    }
    if (ns) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sparkBuf)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sparkData, 0, ns * 4)
      this.sparkP.use().f('uRes', this.W, H).f('uScale', this.scale).f('uTube', ...look.tube).f('uBack', ...look.back)
      gl.bindVertexArray(this.sparkVao)
      gl.drawArrays(gl.POINTS, 0, ns)
    }
    gl.bindVertexArray(null)
    gl.disable(gl.BLEND)
    bindTarget(gl, null, c.width, c.height)
    this.comp.use().tex('uScene', 0, this.scene!.tex).f('uTime', this.time).f('uExposure', 1.1)
    drawFullscreen(gl)
    return { lines: n, sparks: ns }
  }

  dispose() {
    const gl = this.gl
    this.bg.dispose()
    this.lineP.dispose()
    this.sparkP.dispose()
    this.comp.dispose()
    deleteTarget(gl, this.scene)
    gl.deleteBuffer(this.lineBuf)
    gl.deleteBuffer(this.sparkBuf)
    gl.deleteVertexArray(this.lineVao)
    gl.deleteVertexArray(this.sparkVao)
  }
}

function smooth(a: number, b: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
