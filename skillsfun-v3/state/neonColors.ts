import { useSyncExternalStore } from 'react'
import { loadColors, saveColors, type NeonColors } from '../effects/neon/colors'

// The two picked light colors, shared by the neon stage and the footer. Lives
// outside React so it survives the neon canvas unmounting; remembered for the
// session (sessionStorage, see colors.ts).
let current: NeonColors = loadColors()
const subs = new Set<() => void>()

export const neonColors = {
  get: () => current,
  set(c: NeonColors) {
    current = c
    saveColors(c)
    subs.forEach(f => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  },
}

export function useNeonColors() {
  return useSyncExternalStore(neonColors.subscribe, neonColors.get)
}

if (import.meta.env.DEV) (window as unknown as { __setNeonColors?: (c: NeonColors) => void }).__setNeonColors = c => neonColors.set(c)
