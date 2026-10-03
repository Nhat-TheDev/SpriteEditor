import { describe, it, expect } from 'vitest'
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from './color'

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 })
  })

  it('parses a 3-digit shorthand hex color', () => {
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 })
  })
})

describe('rgbToHex', () => {
  it('formats and clamps RGB values into a 6-digit hex string', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000')
    expect(rgbToHex({ r: -10, g: 300, b: 128 })).toBe('#00ff80')
  })
})

describe('rgbToHsl / hslToRgb', () => {
  it('converts pure red between RGB and HSL', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('converts pure green between RGB and HSL', () => {
    expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 })
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('converts white and black (zero saturation)', () => {
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 })
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 })
  })

  it('round-trips an arbitrary color through RGB -> HSL -> RGB within rounding tolerance', () => {
    const original = { r: 192, g: 57, b: 43 }
    const hsl = rgbToHsl(original)
    const restored = hslToRgb(hsl)
    expect(Math.abs(restored.r - original.r)).toBeLessThanOrEqual(2)
    expect(Math.abs(restored.g - original.g)).toBeLessThanOrEqual(2)
    expect(Math.abs(restored.b - original.b)).toBeLessThanOrEqual(2)
  })
})
