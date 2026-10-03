import { describe, it, expect } from 'vitest'
import {
  createEmptyPixels,
  pixelIndex,
  getSymmetricPoints,
  setPixelWithSymmetry,
} from './drawing'

describe('createEmptyPixels', () => {
  it('creates a width*height array of nulls', () => {
    const pixels = createEmptyPixels(3, 2)
    expect(pixels).toHaveLength(6)
    expect(pixels.every((p) => p === null)).toBe(true)
  })
})

describe('pixelIndex', () => {
  it('computes row-major index', () => {
    expect(pixelIndex(2, 1, 4)).toBe(1 * 4 + 2)
  })
})

describe('getSymmetricPoints', () => {
  it('returns mirrored x point for mode x', () => {
    const points = getSymmetricPoints(1, 1, 8, 8, 'x')
    expect(points).toEqual([{ x: 6, y: 1 }])
  })

  it('returns mirrored y point for mode y', () => {
    const points = getSymmetricPoints(1, 1, 8, 8, 'y')
    expect(points).toEqual([{ x: 1, y: 6 }])
  })

  it('returns 3 mirrored points for mode xy', () => {
    const points = getSymmetricPoints(1, 1, 8, 8, 'xy')
    expect(points).toEqual([
      { x: 6, y: 1 },
      { x: 1, y: 6 },
      { x: 6, y: 6 },
    ])
  })

  it('returns no points for mode none', () => {
    expect(getSymmetricPoints(1, 1, 8, 8, 'none')).toEqual([])
  })

  it('does not duplicate the center pixel on odd dimensions', () => {
    // width=5 -> center column index 2; x=2 mirrors to itself
    const points = getSymmetricPoints(2, 0, 5, 5, 'x')
    expect(points).toEqual([])
  })
})

describe('setPixelWithSymmetry', () => {
  it('sets the primary pixel and its x-mirror', () => {
    const pixels = createEmptyPixels(4, 4)
    const result = setPixelWithSymmetry(pixels, 4, 4, 0, 0, '#ff0000', 'x')
    expect(result[pixelIndex(0, 0, 4)]).toBe('#ff0000')
    expect(result[pixelIndex(3, 0, 4)]).toBe('#ff0000')
  })

  it('does not mutate the input array', () => {
    const pixels = createEmptyPixels(4, 4)
    setPixelWithSymmetry(pixels, 4, 4, 0, 0, '#ff0000', 'none')
    expect(pixels[0]).toBeNull()
  })
})

import { bresenhamLine, rectanglePoints, midpointEllipsePoints, floodFill } from './drawing'

describe('bresenhamLine', () => {
  it('draws a horizontal line', () => {
    expect(bresenhamLine(0, 0, 3, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
  })

  it('draws a 45-degree diagonal line', () => {
    expect(bresenhamLine(0, 0, 2, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
  })

  it('handles a single point', () => {
    expect(bresenhamLine(1, 1, 1, 1)).toEqual([{ x: 1, y: 1 }])
  })
})

describe('rectanglePoints', () => {
  it('returns only the border when not filled', () => {
    const points = rectanglePoints(0, 0, 2, 2, false)
    const has = (x: number, y: number) => points.some((p) => p.x === x && p.y === y)
    expect(has(1, 1)).toBe(false) // center not included
    expect(has(0, 0)).toBe(true)
    expect(has(2, 2)).toBe(true)
    expect(points).toHaveLength(8) // perimeter of a 3x3 square
  })

  it('returns every cell when filled', () => {
    const points = rectanglePoints(0, 0, 2, 2, true)
    expect(points).toHaveLength(9) // 3x3 square, all cells
  })

  it('normalizes reversed coordinates', () => {
    const points = rectanglePoints(2, 2, 0, 0, true)
    expect(points).toHaveLength(9)
  })
})

describe('midpointEllipsePoints', () => {
  it('produces a symmetric point set for a filled circle', () => {
    const points = midpointEllipsePoints(4, 4, 3, 3, true)
    const has = (x: number, y: number) => points.some((p) => p.x === x && p.y === y)
    expect(has(4, 4)).toBe(true) // center included when filled
    expect(has(4, 1)).toBe(true) // top of circle (cy - ry)
    expect(has(4, 7)).toBe(true) // bottom of circle (cy + ry)
  })

  it('excludes interior points when not filled', () => {
    const points = midpointEllipsePoints(4, 4, 3, 3, false)
    const has = (x: number, y: number) => points.some((p) => p.x === x && p.y === y)
    expect(has(4, 4)).toBe(false)
  })
})

describe('floodFill', () => {
  it('fills a contiguous null region and stops at a border color', () => {
    const width = 4
    const height = 1
    // [null, null, '#000', null]
    const pixels = createEmptyPixels(width, height)
    pixels[2] = '#000'
    const result = floodFill(pixels, width, height, 0, 0, '#f00')
    expect(result[0]).toBe('#f00')
    expect(result[1]).toBe('#f00')
    expect(result[2]).toBe('#000') // border untouched
    expect(result[3]).toBe(null) // unreachable, untouched
  })

  it('is a no-op when the target color equals the fill color', () => {
    const pixels = createEmptyPixels(2, 2)
    const result = floodFill(pixels, 2, 2, 0, 0, null)
    expect(result).toEqual(pixels)
    expect(result).not.toBe(pixels)
  })
})
