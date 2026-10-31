import { baseTint, fitTextColor, hexToRgb, lightColor, readableTextColor, type NeonColors, type RGB } from './colors'
import { backgroundAt, type NeonLook, type TitleLayout } from './neonRenderer'

export interface StageLook {
  shader: NeonLook
  sub: string // eyebrow + subline
  low: string // labels + SCROLL
  shadowRgb: string // "r g b" of the text shadow ink (backlight-tinted, ~black)
}

const css = (c: RGB, k = 1) => `rgb(${c.map(v => Math.round(Math.min(1, Math.max(0, v * k)) * 255)).join(',')})`

/** everything the stage needs from the two picked colors, solved against the real colored background */
export function makeLook(colors: NeonColors, H: number, title: TitleLayout | null): StageLook {
  const tubeHex = hexToRgb(colors.tube)
  const backHex = hexToRgb(colors.back)
  const light = { tube: lightColor(tubeHex), back: lightColor(backHex), baseTint: baseTint(backHex) }
  const titleY = title ? (title.capTop + title.baseline) / 2 : H * 0.55
  const shader: NeonLook = {
    ...light,
    text: fitTextColor(backHex, backgroundAt(titleY, H, light, 0.1), 0.78),
  }
  // secondary text: a muted tint that still clears 4.5:1 at its own height
  const sub = readableTextColor(backHex, backgroundAt(title ? title.baseline + 40 : H * 0.62, H, light), 0.82)
  const low = readableTextColor(backHex, backgroundAt(H - 40, H, light), 0.82)
  const ink = backHex.map(v => v * 0.08)
  return {
    shader,
    sub: css(sub, 0.82),
    low: css(low, 0.82),
    shadowRgb: ink.map(v => Math.round(v * 255)).join(' '),
  }
}
