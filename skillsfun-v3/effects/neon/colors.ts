// Color helpers for the neon picker: hex <-> rgb <-> hsv, WCAG contrast,
// a readable-text solver and session persistence.

export type RGB = [number, number, number] // 0..1, display (sRGB) values

export interface NeonColors {
  tube: string
  back: string
}

export const DEFAULT_COLORS: NeonColors = { tube: '#fbfaf8', back: '#e9e9ec' }

export function normalizeHex(input: string): string | null {
  let s = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map(c => c + c).join('')
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null
}

export function hexToRgb(hex: string): RGB {
  const s = (normalizeHex(hex) ?? '#ffffff').slice(1)
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255) as RGB
}

export function rgbToHex([r, g, b]: RGB) {
  const h = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** h 0..1, s 0..1, v 0..1 */
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + h * 6) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5), f(3), f(1)]
}

export function rgbToHsv([r, g, b]: RGB): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
    if (h < 0) h += 1
  }
  return [h, max === 0 ? 0 : d / max, max]
}

export const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
export const srgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055)

/**
 * A picked color as light for the shader: linear-light chroma (ratios in linear
 * sRGB) scaled to the color's sRGB peak. Neutrals come out exactly as before
 * (#e9e9ec -> 0.914 peak), saturated colors keep their full chroma.
 */
export function lightColor(c: RGB): RGB {
  const l = c.map(lin) as RGB
  const m = Math.max(...l, 1e-5)
  const peak = Math.max(...c)
  return [(l[0] / m) * peak, (l[1] / m) * peak, (l[2] / m) * peak]
}

/** the dark base's chroma: ~8% of the backlight's, luminance-normalised (neutral -> 1,1,1) */
export function baseTint(back: RGB, amount = 0.08): RGB {
  const l = back.map(lin) as RGB
  const y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
  if (y < 1e-4) return [1, 1, 1]
  return l.map(v => 1 - amount + (amount * v) / y) as RGB
}
export const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
export function contrast(a: RGB, b: RGB) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k]

/**
 * Lit-text color for a backlight: keeps as much of the backlight's tint as it
 * can while the DIMMEST part of the lettering (`minShade` of the color, the
 * bottom of the silver gradient) still reaches 4.5:1 against `bg`. Falls back
 * to near-black when the background behind the text is light.
 */
export function readableTextColor(back: RGB, bg: RGB, minShade = 0.78): RGB {
  const peak = Math.max(back[0], back[1], back[2], 1e-3)
  const tint: RGB = scale(back, 1 / peak) // full-brightness version of the hue
  if (luminance(bg) < 0.18) {
    for (let k = 0.3; k <= 1.0001; k += 0.02) {
      const c = mix(tint, [1, 1, 1], k)
      if (contrast(scale(c, minShade), bg) >= 4.5) return c
    }
    return [1, 1, 1]
  }
  for (let k = 0.3; k <= 1.0001; k += 0.02) {
    const c = mix(scale(tint, 0.25), [0.05, 0.05, 0.05], k)
    if (contrast(c, bg) >= 4.5) return c
  }
  return [0.05, 0.05, 0.05]
}

/**
 * Title lettering: the readable tint, dimmed to the `preferred` brightness of the
 * original silver look, or brighter only as far as 4.5:1 needs.
 */
export function fitTextColor(back: RGB, bg: RGB, minShade: number, preferred = 0.74): RGB {
  const c = readableTextColor(back, bg, minShade)
  if (luminance(bg) >= 0.18) return c
  for (let m = preferred; m <= 1.0001; m += 0.02) if (contrast(scale(c, m * minShade), bg) >= 4.5) return scale(c, m)
  return c
}

const KEY = 'sf-lab-v3:neon-colors'

export function loadColors(): NeonColors {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return DEFAULT_COLORS
    const v = JSON.parse(raw) as Partial<NeonColors>
    const tube = normalizeHex(v.tube ?? '')
    const back = normalizeHex(v.back ?? '')
    return tube && back ? { tube, back } : DEFAULT_COLORS
  } catch {
    return DEFAULT_COLORS
  }
}

export function saveColors(c: NeonColors) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    // storage blocked (private mode, sandbox): colors just won't persist
  }
}
