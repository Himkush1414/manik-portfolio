import {
  Bloom,
  COMPOSITE_FS,
  Program,
  bindTarget,
  createContext,
  createTarget,
  deleteTarget,
  drawFullscreen,
  loseContext,
  supportsHalfFloatTargets,
  type GL,
  type Target,
} from '../../gl/gl'
import { lin, srgb, type RGB } from './colors'
import { NEON_SCENE_FS } from './neonShader'
import type { NeonState } from './neonTimeline'

export const TITLE = 'Skills & Fun'
export const STAGE_BG = 10 / 255
const EXPOSURE = 1.0

/** tube distance from the top: ~9vh, clamped 56..100px */
export const tubeYFor = (H: number) => Math.min(100, Math.max(56, H * 0.09))

export interface TitleLayout {
  rect: [number, number, number, number] // x, y, w, h (css px), the texture's box
  capTop: number // top of the first line's capitals
  baseline: number // last line's baseline
  fontSize: number
  lines: string[]
}

const TITLE_CENTER = 0.55 // vertical center of the lettering, x viewport height

export function titleLayout(W: number, H: number): TitleLayout {
  const fs = Math.min(150, Math.max(56, W * 0.07))
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.font = `900 ${fs}px Inter, "Helvetica Neue", Arial, sans-serif`
  ctx.letterSpacing = `${-0.03 * fs}px`
  let lines = [TITLE]
  if (ctx.measureText(TITLE).width > W - 40) lines = ['Skills &', 'Fun']
  const widths = lines.map(l => ctx.measureText(l).width)
  const lineH = fs * 0.9
  const capH = fs * 0.74
  const pad = Math.ceil(fs * 0.2)
  const textH = lineH * (lines.length - 1) + capH
  const capTop = Math.round(H * TITLE_CENTER - textH / 2)
  const rectW = Math.ceil(Math.max(...widths) + pad * 2)
  const rectH = Math.ceil(textH + pad * 2)
  return {
    rect: [Math.round((W - rectW) / 2), capTop - pad, rectW, rectH],
    capTop,
    baseline: capTop + textH,
    fontSize: fs,
    lines,
  }
}

// R = coverage, G = coverage x (0 at each line's cap top -> 1 at its baseline)
function titleTexture(t: TitleLayout, scale: number) {
  const [, , rectW, rectH] = t.rect
  const fs = t.fontSize
  const pad = Math.ceil(fs * 0.2)
  const capH = fs * 0.74
  const lineH = fs * 0.9
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(rectW * scale)
  canvas.height = Math.ceil(rectH * scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, rectW, rectH)
  ctx.font = `900 ${fs}px Inter, "Helvetica Neue", Arial, sans-serif`
  ctx.letterSpacing = `${-0.03 * fs}px`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  t.lines.forEach((line, i) => {
    const base = pad + capH + i * lineH
    const g = ctx.createLinearGradient(0, base - capH * 1.04, 0, base + fs * 0.05)
    g.addColorStop(0, 'rgb(255,0,0)')
    g.addColorStop(1, 'rgb(255,255,0)')
    ctx.fillStyle = g
    // letterSpacing adds trailing space after the last glyph; shift back half of it
    ctx.fillText(line, rectW / 2 - 0.015 * fs, base)
  })
  return canvas
}

export interface NeonLook {
  tube: RGB // light colors (lightColor())
  back: RGB
  text: RGB // target on-screen color of the title
  baseTint: RGB
}

export interface RenderOpts {
  time: number
  textFade: number
  bg: number // composite background, display value (fades to 0 with the scroll)
  grain: number
}

export class NeonRenderer {
  readonly gl: GL
  private scene: Program
  private comp: Program
  private bloom: Bloom
  private hdr: boolean
  private sceneT: Target | null = null
  private textTex: WebGLTexture | null = null
  private withText: boolean
  W = 1
  H = 1
  scale = 1
  title: TitleLayout | null = null

  static create(canvas: HTMLCanvasElement, withText: boolean) {
    const gl = createContext(canvas)
    return gl ? new NeonRenderer(gl, withText) : null
  }

  private constructor(gl: GL, withText: boolean) {
    this.gl = gl
    this.withText = withText
    this.hdr = supportsHalfFloatTargets(gl)
    this.scene = new Program(gl, NEON_SCENE_FS)
    this.comp = new Program(gl, COMPOSITE_FS)
    this.bloom = new Bloom(gl, this.hdr)
    // always bind something to uText: an unbound sampler falls back to whatever
    // sits on unit 0, which can be the very target being drawn (feedback loop)
    this.textTex = gl.createTexture()
    if (!withText) {
      gl.bindTexture(gl.TEXTURE_2D, this.textTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
    }
  }

  resize(W: number, H: number, scale: number) {
    const gl = this.gl
    this.W = Math.max(1, W)
    this.H = Math.max(1, H)
    this.scale = scale
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.width = Math.round(this.W * scale)
    canvas.height = Math.round(this.H * scale)
    deleteTarget(gl, this.sceneT)
    this.sceneT = createTarget(gl, canvas.width, canvas.height, this.hdr)
    this.bloom.resize(canvas.width, canvas.height)
    this.uploadTitle()
  }

  /** (re)draw the title texture, e.g. once the heavy face has loaded */
  uploadTitle() {
    if (!this.withText || !this.textTex) return
    const gl = this.gl
    this.title = titleLayout(this.W, this.H)
    gl.bindTexture(gl.TEXTURE_2D, this.textTex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, titleTexture(this.title, this.scale))
    // mips: the drop shadow samples a blurred copy of the lettering via textureLod
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  render(s: NeonState, look: NeonLook, o: RenderOpts) {
    const gl = this.gl
    const canvas = gl.canvas as HTMLCanvasElement
    const sceneT = this.sceneT!
    bindTarget(gl, sceneT)
    this.scene
      .use()
      .f('uRes', this.W, this.H)
      .f('uScale', this.scale)
      .f('uTubeY', this.withText ? tubeYFor(this.H) : Math.min(24, this.H * 0.25))
      .f('uTube', s.tube)
      .f('uSpill', s.spill)
      .f('uHalf', s.half)
      .f('uTip', s.tip)
      .f('uTime', o.time)
      .f('uTubeColor', ...look.tube)
      .f('uBackColor', ...look.back)
      .f('uTextColor', ...look.text)
      .f('uTextFade', o.textFade)
      .f('uShowText', this.withText ? 1 : 0)
      .f('uBg', o.bg)
      .f('uExposure', EXPOSURE)
      .f('uTextRect', ...(this.title?.rect ?? [0, 0, 1, 1]))
      .f('uTitleFs', this.title?.fontSize ?? 80)
    this.scene.tex('uText', 0, this.textTex!)
    drawFullscreen(gl)
    const bl = this.bloom.run(sceneT, 1.2, 0.6, 1.0)
    bindTarget(gl, null, canvas.width, canvas.height)
    this.comp
      .use()
      .tex('uScene', 0, sceneT.tex)
      .tex('uBloom', 1, bl.tex)
      .f('uBloomStrength', 0.75)
      .f('uExposure', EXPOSURE)
      .f('uBg', o.bg)
      .f('uBaseTint', ...look.baseTint)
      .f('uGrain', o.grain)
      .f('uTime', o.time)
      .f('uFade', 1)
    drawFullscreen(gl)
  }

  dispose() {
    const gl = this.gl
    this.scene.dispose()
    this.comp.dispose()
    this.bloom.dispose()
    deleteTarget(gl, this.sceneT)
    if (this.textTex) gl.deleteTexture(this.textTex)
    loseContext(gl)
  }
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** JS mirror of the composite: linear light -> on-screen sRGB */
export function composite(light: RGB, baseTint: RGB, bg = STAGE_BG): RGB {
  const m = Math.max(...light)
  const ratio = m > 1e-5 ? light.map(v => v / m) : [1, 1, 1]
  const d = bg + (1 - bg) * (1 - Math.exp(-m * EXPOSURE))
  const bgLin = lin(bg)
  return ratio.map((r, i) => srgb(bgLin * baseTint[i] + (lin(d) - bgLin) * r)) as RGB
}

/** on-screen color behind something at css y, straight under the lit tube (for the contrast solver) */
export function backgroundAt(y: number, H: number, look: Pick<NeonLook, 'tube' | 'back' | 'baseTint'>, extraGlow = 0): RGB {
  const depth = Math.max(0, y - tubeYFor(H)) / H
  const fall = Math.pow(1 - smooth(0, 0.68, depth), 2)
  const pour = fall * 0.5 + Math.exp(-depth * 22) * 0.45
  const bMax = Math.max(...look.back)
  const tMax = Math.max(...look.tube, 1e-4)
  const k = smooth(0, 0.3, depth)
  const spill = look.tube.map((t, i) => (t * bMax) / tMax + (look.back[i] - (t * bMax) / tMax) * k)
  const light = spill.map((c, i) => c * pour + look.back[i] * extraGlow) as RGB
  return composite(light, look.baseTint)
}

/** how much of the tube's light reaches css point (x, y): same falloff the shader uses */
export function lightReach(x: number, y: number, W: number, H: number, s: NeonState) {
  const L = s.half * 0.45 * W
  const dx = Math.max(Math.abs(x - W / 2) - L, 0)
  const depth = Math.max(0, y - tubeYFor(H)) / H
  const spread = W * (0.016 + depth * 0.2) * 0.8
  return Math.exp(-(dx * dx) / (spread * spread)) * s.spill
}
