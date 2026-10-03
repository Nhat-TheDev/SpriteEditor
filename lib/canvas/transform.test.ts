import { describe, it, expect } from 'vitest'
import { pointInPolygon, cutSelection, pasteSelection, clampShift, pixelBounds } from './transform'
import type { Pixel } from '../types'
import { createEmptyPixels, pixelIndex } from './drawing'

describe('pointInPolygon', () => {
  it('detects a point inside a square polygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]
    expect(pointInPolygon(2, 2, square)).toBe(true)
    expect(pointInPolygon(10, 10, square)).toBe(false)
  })
})

describe('cutSelection', () => {
  it('extracts pixels inside the polygon into a buffer and clears them from the source', () => {
    const width = 4
    const height = 4
    const pixels = createEmptyPixels(width, height)
    pixels[pixelIndex(1, 1, width)] = '#ff0000'
    const square = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ]
    const { remaining, buffer } = cutSelection(pixels, width, height, square)
    expect(remaining[pixelIndex(1, 1, width)]).toBeNull()
    expect(buffer.originX).toBe(1)
    expect(buffer.originY).toBe(1)
    expect(buffer.pixels[pixelIndex(0, 0, buffer.width)]).toBe('#ff0000')
  })

  it('keeps the outermost row and column of the traced outline', () => {
    const width = 8
    const height = 8
    const pixels = createEmptyPixels(width, height)
    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 5; x++) pixels[pixelIndex(x, y, width)] = '#ff0000'
    }
    // the freehand path the user drags: a 4x4 outline over pixels (2,2)-(5,5)
    const traced = [
      { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
      { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 },
      { x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 },
      { x: 2, y: 4 }, { x: 2, y: 3 },
    ]
    const { remaining, buffer } = cutSelection(pixels, width, height, traced)

    expect(buffer.width).toBe(4)
    expect(buffer.height).toBe(4)
    // every pixel the path enclosed or ran over must come across, including the
    // far row and column that the ray-casting boundary test used to drop
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(buffer.pixels[pixelIndex(x, y, buffer.width)]).toBe('#ff0000')
      }
    }
    expect(remaining[pixelIndex(5, 5, width)]).toBeNull()
    expect(remaining[pixelIndex(2, 5, width)]).toBeNull()
    expect(remaining[pixelIndex(5, 2, width)]).toBeNull()
  })
})

describe('pasteSelection', () => {
  it('writes the buffer back at an offset, skipping out-of-bounds cells', () => {
    const width = 4
    const height = 4
    const pixels = createEmptyPixels(width, height)
    const buffer = { width: 2, height: 1, originX: 0, originY: 0, pixels: ['#111', '#222'] }
    const result = pasteSelection(pixels, width, height, buffer, 2, 0)
    expect(result[pixelIndex(2, 0, width)]).toBe('#111')
    expect(result[pixelIndex(3, 0, width)]).toBe('#222')
  })

  it('skips transparent buffer cells (does not overwrite with null)', () => {
    const width = 2
    const height = 1
    const pixels = createEmptyPixels(width, height)
    pixels[0] = '#existing'
    const buffer = { width: 1, height: 1, originX: 0, originY: 0, pixels: [null] }
    const result = pasteSelection(pixels, width, height, buffer, 0, 0)
    expect(result[0]).toBe('#existing')
  })
})

import { rasterizeTransform } from './transform'

describe('rasterizeTransform', () => {
  it('scale=1, rotation=0 returns the buffer unchanged in content', () => {
    const buffer = { width: 2, height: 2, originX: 0, originY: 0, pixels: ['#a', '#b', '#c', '#d'] }
    const result = rasterizeTransform(buffer, 1, 1, 0)
    expect(result.pixels).toEqual(['#a', '#b', '#c', '#d'])
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
  })

  it('uniform scale 2x doubles both width and height (keeps square square)', () => {
    const buffer = { width: 2, height: 2, originX: 0, originY: 0, pixels: ['#a', '#a', '#a', '#a'] }
    const result = rasterizeTransform(buffer, 2, 2, 0)
    expect(result.width).toBe(4)
    expect(result.height).toBe(4)
    expect(result.width / result.height).toBe(buffer.width / buffer.height)
  })

  it('scales the two axes independently so a square can become a rectangle', () => {
    const buffer = { width: 2, height: 2, originX: 0, originY: 0, pixels: ['#a', '#a', '#a', '#a'] }
    const result = rasterizeTransform(buffer, 3, 1, 0)
    expect(result.width).toBe(6)
    expect(result.height).toBe(2)
  })

  it('rotates a quarter turn as an exact permutation', () => {
    // 2x2 with four distinct colours, so any mix-up is visible
    const buffer = { width: 2, height: 2, originX: 0, originY: 0, pixels: ['#a', '#b', '#c', '#d'] }
    const turned = rasterizeTransform(buffer, 1, 1, Math.PI / 2)
    expect(turned.width).toBe(2)
    expect(turned.height).toBe(2)
    // clockwise: top row (a b) becomes the right column (a on top of b)
    expect(turned.pixels).toEqual(['#c', '#a', '#d', '#b'])
  })

  it('returns the original buffer after four quarter turns', () => {
    const buffer = { width: 3, height: 2, originX: 0, originY: 0, pixels: ['#a', '#b', '#c', '#d', '#e', '#f'] }
    const turned = rasterizeTransform(buffer, 1, 1, Math.PI * 2)
    expect(turned.width).toBe(3)
    expect(turned.height).toBe(2)
    expect(turned.pixels).toEqual(buffer.pixels)
  })

  it('replicates every pixel exactly at an integer scale', () => {
    const buffer = { width: 2, height: 1, originX: 0, originY: 0, pixels: ['#a', '#b'] }
    const scaled = rasterizeTransform(buffer, 3, 3, 0)
    expect(scaled.width).toBe(6)
    expect(scaled.height).toBe(3)
    for (let y = 0; y < 3; y++) {
      expect(scaled.pixels.slice(y * 6, y * 6 + 6)).toEqual(['#a', '#a', '#a', '#b', '#b', '#b'])
    }
  })

  it('loses no pixels when shear-rotating by an awkward angle', () => {
    const buffer = { width: 6, height: 6, originX: 0, originY: 0, pixels: new Array(36).fill('#a') }
    const filled = (b: { pixels: Pixel[] }) => b.pixels.filter((p) => p !== null).length
    for (const degrees of [15, 30, 45, -45, 70]) {
      const rotated = rasterizeTransform(buffer, 1, 1, (degrees * Math.PI) / 180)
      // the three shears copy each source pixel exactly once, so a solid block
      // stays solid instead of breaking up into speckle
      expect(filled(rotated)).toBe(36)
      expect(rotated.pixels.length).toBe(rotated.width * rotated.height)
    }
  })

  it('keeps a one-pixel line alive when halving the size', () => {
    // a vertical line on transparency, the case point sampling skips over
    const width = 8
    const height = 8
    const pixels: Pixel[] = new Array(width * height).fill(null)
    for (let y = 0; y < height; y++) pixels[y * width + 3] = '#line'
    const shrunk = rasterizeTransform({ width, height, originX: 0, originY: 0, pixels }, 0.5, 0.5, 0)

    expect(shrunk.width).toBe(4)
    expect(shrunk.pixels.filter((p) => p === '#line').length).toBeGreaterThan(0)
  })

  it('keeps the dominant colour of a block when shrinking', () => {
    // 4x4: mostly '#bulk' with a single stray pixel that must not take over
    const pixels: Pixel[] = new Array(16).fill('#bulk')
    pixels[0] = '#stray'
    const shrunk = rasterizeTransform({ width: 4, height: 4, originX: 0, originY: 0, pixels }, 0.25, 0.25, 0)
    expect(shrunk.width).toBe(1)
    expect(shrunk.pixels[0]).toBe('#bulk')
  })

  it('rotating 90 degrees keeps a square looking like a square (same bounding box size)', () => {
    const buffer = { width: 4, height: 4, originX: 0, originY: 0, pixels: new Array(16).fill('#a') }
    const result = rasterizeTransform(buffer, 1, 1, Math.PI / 2)
    expect(Math.abs(result.width - buffer.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(result.height - buffer.height)).toBeLessThanOrEqual(1)
    expect(result.pixels.filter((p) => p !== null).length).toBeGreaterThan(0)
  })
})

describe('clampShift', () => {
  // a block of `size` cells starting at `start` on a track of `extent` cells
  it('leaves a shift that stays inside untouched', () => {
    expect(clampShift(2, 1, 3, 10)).toBe(2)
    expect(clampShift(-1, 1, 3, 10)).toBe(-1)
  })

  it('stops the block flush against either end', () => {
    expect(clampShift(50, 1, 3, 10)).toBe(6) // the block ends up on cells 7..9
    expect(clampShift(-50, 4, 3, 10)).toBe(-4)
  })

  it('does not move a block that fills the whole track', () => {
    expect(clampShift(3, 0, 10, 10)).toBe(0)
    expect(clampShift(-3, 0, 10, 10)).toBe(0)
  })

  it('lets a block that is already past an end move back in but not further out', () => {
    expect(clampShift(-2, -1, 4, 10)).toBe(0) // already hanging off the start
    expect(clampShift(3, -1, 4, 10)).toBe(3)
    expect(clampShift(2, 8, 4, 10)).toBe(0) // already hanging off the end
    expect(clampShift(-3, 8, 4, 10)).toBe(-3)
  })

  it('keeps a block larger than the track covering it', () => {
    expect(clampShift(5, 0, 12, 10)).toBe(0)
    expect(clampShift(-5, 0, 12, 10)).toBe(-2)
  })
})

describe('pixelBounds', () => {
  it('returns the smallest rectangle around the painted pixels', () => {
    const pixels: Pixel[] = new Array(5 * 4).fill(null)
    pixels[1 * 5 + 2] = '#ff0000'
    pixels[3 * 5 + 4] = '#00ff00'
    expect(pixelBounds(pixels, 5, 4)).toEqual({ minX: 2, maxX: 4, minY: 1, maxY: 3 })
  })

  it('returns null when nothing is painted', () => {
    expect(pixelBounds(new Array(6).fill(null), 3, 2)).toBeNull()
  })
})
