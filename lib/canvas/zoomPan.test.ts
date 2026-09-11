import { describe, it, expect } from 'vitest'
import { screenToPixel, clampZoom } from './zoomPan'

describe('screenToPixel', () => {
  it('converts a screen coordinate to a pixel coordinate at zoom 1', () => {
    const result = screenToPixel(10, 10, { left: 0, top: 0 }, 1, 0, 0)
    expect(result).toEqual({ x: 10, y: 10 })
  })

  it('accounts for zoom', () => {
    const result = screenToPixel(20, 20, { left: 0, top: 0 }, 4, 0, 0)
    expect(result).toEqual({ x: 5, y: 5 })
  })

  it('accounts for canvas offset and pan', () => {
    const result = screenToPixel(50, 50, { left: 10, top: 10 }, 2, 5, 5)
    // (50-10)/2 - 5 = 15, (50-10)/2 - 5 = 15
    expect(result).toEqual({ x: 15, y: 15 })
  })
})

describe('clampZoom', () => {
  it('clamps below the minimum to 1', () => {
    expect(clampZoom(0)).toBe(1)
  })

  it('clamps above the maximum to 64', () => {
    expect(clampZoom(1000)).toBe(64)
  })

  it('passes through values in range', () => {
    expect(clampZoom(10)).toBe(10)
  })
})
