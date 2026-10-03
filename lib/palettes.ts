import { hslToHex } from './color'

export interface PresetPalette {
  name: string
  colors: string[]
}

/**
 * Preset palettes are generated from HSL ramps rather than listed as literals,
 * so they stay consistent, are trivial to retune, and are our own colours
 * rather than someone else's curated set.
 */
function ramp(count: number, at: (t: number) => { h: number; s: number; l: number }): string[] {
  return Array.from({ length: count }, (_, i) => hslToHex(at(count === 1 ? 0 : i / (count - 1))))
}

export const PRESET_PALETTES: PresetPalette[] = [
  {
    name: 'Grayscale',
    colors: ramp(12, (t) => ({ h: 0, s: 0, l: Math.round(t * 100) })),
  },
  {
    name: 'Spectrum',
    colors: ramp(16, (t) => ({ h: Math.round(t * 345), s: 72, l: 54 })),
  },
  {
    name: 'Warm',
    colors: ramp(12, (t) => ({ h: Math.round(-12 + t * 72), s: 78, l: Math.round(28 + t * 46) })),
  },
  {
    name: 'Cool',
    colors: ramp(12, (t) => ({ h: Math.round(168 + t * 92), s: 62, l: Math.round(26 + t * 50) })),
  },
  {
    name: 'Pastel',
    colors: ramp(12, (t) => ({ h: Math.round(t * 330), s: 54, l: 78 })),
  },
  {
    name: 'Earth',
    colors: ramp(12, (t) => ({ h: Math.round(16 + t * 62), s: Math.round(48 - t * 20), l: Math.round(24 + t * 52) })),
  },
]
