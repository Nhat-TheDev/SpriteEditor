import type { Pixel } from '../types'
import { bresenhamLine, pixelIndex } from './drawing'

export interface SelectionBuffer {
  width: number
  height: number
  originX: number
  originY: number
  pixels: Pixel[]
}

export function pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Smallest rectangle holding every non-transparent pixel, or null when there is none. */
export function pixelBounds(pixels: Pixel[], width: number, height: number) {
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * width + x] === null) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  return maxX < 0 ? null : { minX, maxX, minY, maxY }
}

/**
 * Limits a shift so a block of `size` cells starting at `start` stays inside a
 * track of `extent` cells, and returns the shift to apply. A block that is
 * already past an end (a scaled or rotated selection can be) is never pushed
 * further out, but can always move back in; one larger than the track keeps
 * covering it.
 */
export function clampShift(delta: number, start: number, size: number, extent: number): number {
  const lo = Math.min(0, extent - size, start)
  const hi = Math.max(0, extent - size, start)
  return Math.min(hi, Math.max(lo, start + delta)) - start
}

export function cutSelection(
  pixels: Pixel[],
  width: number,
  height: number,
  polygon: { x: number; y: number }[]
): { remaining: Pixel[]; buffer: SelectionBuffer } {
  const xs = polygon.map((p) => p.x)
  const ys = polygon.map((p) => p.y)
  const minX = Math.max(0, Math.floor(Math.min(...xs)))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...xs)))
  const minY = Math.max(0, Math.floor(Math.min(...ys)))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)))
  const bufWidth = Math.max(1, maxX - minX + 1)
  const bufHeight = Math.max(1, maxY - minY + 1)

  const remaining = pixels.slice()
  const bufferPixels: Pixel[] = new Array(bufWidth * bufHeight).fill(null)

  // The polygon's vertices are pixel coordinates, i.e. pixel CORNERS, while the
  // test below samples pixel CENTRES — half a pixel apart. On top of that,
  // ray casting uses a strict comparison, so a centre landing exactly on the
  // traced edge counts as outside. Together those drop the outermost row and
  // column of the shape the user drew. Rasterising the traced outline and
  // unioning it in makes every pixel the lasso passed over part of the
  // selection, which is also what the dashed preview shows.
  const onOutline = new Set<number>()
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    for (const p of bresenhamLine(a.x, a.y, b.x, b.y)) {
      if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue
      onOutline.add(pixelIndex(p.x, p.y, width))
    }
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const srcIdx = pixelIndex(x, y, width)
      if (!onOutline.has(srcIdx) && !pointInPolygon(x + 0.5, y + 0.5, polygon)) continue
      bufferPixels[(y - minY) * bufWidth + (x - minX)] = remaining[srcIdx]
      remaining[srcIdx] = null
    }
  }

  return {
    remaining,
    buffer: { width: bufWidth, height: bufHeight, originX: minX, originY: minY, pixels: bufferPixels },
  }
}

export function pasteSelection(
  pixels: Pixel[],
  width: number,
  height: number,
  buffer: SelectionBuffer,
  offsetX: number,
  offsetY: number
): Pixel[] {
  const next = pixels.slice()
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const color = buffer.pixels[y * buffer.width + x]
      if (color === null) continue
      const destX = offsetX + x
      const destY = offsetY + y
      if (destX < 0 || destX >= width || destY < 0 || destY >= height) continue
      next[pixelIndex(destX, destY, width)] = color
    }
  }
  return next
}

/**
 * Rotates and scales a selection buffer. The two axes scale independently so a
 * corner drag can stretch width and height on their own; pass the same value
 * for both to keep the aspect ratio.
 *
 * `fast` runs a single destination->source nearest-neighbour pass, cheap enough
 * for every pointermove of a drag. The default quality path splits the work so
 * that solid blocks of colour survive it: scale by area majority, turn by whole
 * quarters (a pure index permutation, exact), then shear-rotate whatever angle
 * is left over. See rasterizeQuality below.
 *
 * Both paths only ever emit colours that already exist in the source — nothing
 * here blends, because an invented in-between colour is not pixel art.
 */
export function rasterizeTransform(
  buffer: SelectionBuffer,
  scaleX: number,
  scaleY: number,
  rotationRad: number,
  options?: { fast?: boolean }
): SelectionBuffer {
  if (options?.fast) return rasterizeFast(buffer, scaleX, scaleY, rotationRad)
  return rasterizeQuality(buffer, scaleX, scaleY, rotationRad)
}

const QUARTER = Math.PI / 2

/**
 * Scale, then whole quarter turns, then a shear rotation for the remainder.
 * Splitting the angle matters: a quarter turn is lossless, and the shear only
 * ever has to cope with at most 45 degrees, where its distortion is smallest.
 */
function rasterizeQuality(
  buffer: SelectionBuffer,
  scaleX: number,
  scaleY: number,
  rotationRad: number
): SelectionBuffer {
  const normalised = ((rotationRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const nearestQuarter = Math.round(normalised / QUARTER)
  const residual = normalised - nearestQuarter * QUARTER
  const quarters = ((nearestQuarter % 4) + 4) % 4

  let out = resampleScale(buffer, scaleX, scaleY)
  out = quarterTurn(out, quarters)
  if (Math.abs(residual) > 1e-6) out = shearRotate(out, residual)
  return { ...out, originX: buffer.originX, originY: buffer.originY }
}

/**
 * Resamples by area: every destination pixel takes the colour that covers most
 * of its footprint in the source, ignoring transparency unless the whole
 * footprint is transparent. When shrinking, that is what keeps a block of
 * colour solid and stops a one-pixel line from being skipped over entirely;
 * point sampling would keep whichever pixel the rounding happened to land on.
 * When growing, each footprint covers a single source pixel, so an integer
 * scale replicates the source exactly.
 */
function resampleScale(buffer: SelectionBuffer, scaleX: number, scaleY: number): SelectionBuffer {
  const destWidth = Math.max(1, Math.round(buffer.width * scaleX))
  const destHeight = Math.max(1, Math.round(buffer.height * scaleY))
  if (destWidth === buffer.width && destHeight === buffer.height) return buffer

  const pixels: Pixel[] = new Array(destWidth * destHeight).fill(null)
  for (let dy = 0; dy < destHeight; dy++) {
    const y0 = Math.min(buffer.height - 1, Math.floor((dy * buffer.height) / destHeight))
    const y1 = Math.min(buffer.height, Math.max(y0 + 1, Math.ceil(((dy + 1) * buffer.height) / destHeight)))
    for (let dx = 0; dx < destWidth; dx++) {
      const x0 = Math.min(buffer.width - 1, Math.floor((dx * buffer.width) / destWidth))
      const x1 = Math.min(buffer.width, Math.max(x0 + 1, Math.ceil(((dx + 1) * buffer.width) / destWidth)))
      pixels[dy * destWidth + dx] = majorityColor(buffer, x0, y0, x1, y1)
    }
  }
  return { ...buffer, width: destWidth, height: destHeight, pixels }
}

function majorityColor(
  buffer: SelectionBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Pixel {
  const counts = new Map<string, number>()
  let best: Pixel = null
  let bestCount = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const color = buffer.pixels[y * buffer.width + x]
      if (color === null) continue
      const count = (counts.get(color) ?? 0) + 1
      counts.set(color, count)
      if (count > bestCount) {
        bestCount = count
        best = color
      }
    }
  }
  return best
}

/** Rotates by whole quarter turns. Pure index permutation — nothing is lost. */
function quarterTurn(buffer: SelectionBuffer, turns: number): SelectionBuffer {
  let out = buffer
  for (let i = 0; i < turns; i++) {
    const { width, height, pixels } = out
    const rotated: Pixel[] = new Array(width * height).fill(null)
    // clockwise: source (x, y) lands at (height - 1 - y, x) in a height x width grid
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        rotated[x * height + (height - 1 - y)] = pixels[y * width + x]
      }
    }
    out = { ...out, width: height, height: width, pixels: rotated }
  }
  return out
}

/**
 * Paeth three-shear rotation: x-shear, y-shear, x-shear. Each shear slides a
 * whole row or column by an integer number of pixels, so every source pixel is
 * copied exactly once — no pixel is dropped or duplicated, which is what keeps
 * a solid block solid and an outline connected at awkward angles. Only sound
 * for small angles, hence the quarter-turn split before it.
 */
function shearRotate(buffer: SelectionBuffer, radians: number): SelectionBuffer {
  const alpha = -Math.tan(radians / 2)
  const beta = Math.sin(radians)
  return shearX(shearY(shearX(buffer, alpha), beta), alpha)
}

function shearX(buffer: SelectionBuffer, factor: number): SelectionBuffer {
  const center = (buffer.height - 1) / 2
  const offsets = Array.from({ length: buffer.height }, (_, y) => Math.round(factor * (y - center)))
  const minOffset = Math.min(...offsets)
  const destWidth = buffer.width + (Math.max(...offsets) - minOffset)

  const pixels: Pixel[] = new Array(destWidth * buffer.height).fill(null)
  for (let y = 0; y < buffer.height; y++) {
    const shift = offsets[y] - minOffset
    for (let x = 0; x < buffer.width; x++) {
      pixels[y * destWidth + x + shift] = buffer.pixels[y * buffer.width + x]
    }
  }
  return { ...buffer, width: destWidth, pixels }
}

function shearY(buffer: SelectionBuffer, factor: number): SelectionBuffer {
  const center = (buffer.width - 1) / 2
  const offsets = Array.from({ length: buffer.width }, (_, x) => Math.round(factor * (x - center)))
  const minOffset = Math.min(...offsets)
  const destHeight = buffer.height + (Math.max(...offsets) - minOffset)

  const pixels: Pixel[] = new Array(buffer.width * destHeight).fill(null)
  for (let x = 0; x < buffer.width; x++) {
    const shift = offsets[x] - minOffset
    for (let y = 0; y < buffer.height; y++) {
      pixels[(y + shift) * buffer.width + x] = buffer.pixels[y * buffer.width + x]
    }
  }
  return { ...buffer, height: destHeight, pixels }
}

function rasterizeFast(
  buffer: SelectionBuffer,
  scaleX: number,
  scaleY: number,
  rotationRad: number
): SelectionBuffer {
  const srcCx = buffer.width / 2
  const srcCy = buffer.height / 2

  const corners = [
    { x: 0, y: 0 },
    { x: buffer.width, y: 0 },
    { x: buffer.width, y: buffer.height },
    { x: 0, y: buffer.height },
  ].map(({ x, y }) => rotatePoint((x - srcCx) * scaleX, (y - srcCy) * scaleY, rotationRad))

  const minX = Math.min(...corners.map((c) => c.x))
  const maxX = Math.max(...corners.map((c) => c.x))
  const minY = Math.min(...corners.map((c) => c.y))
  const maxY = Math.max(...corners.map((c) => c.y))

  const destWidth = Math.max(1, Math.round(maxX - minX))
  const destHeight = Math.max(1, Math.round(maxY - minY))
  const destCx = destWidth / 2
  const destCy = destHeight / 2

  const pixels: Pixel[] = new Array(destWidth * destHeight).fill(null)
  const cos = Math.cos(-rotationRad)
  const sin = Math.sin(-rotationRad)

  for (let dy = 0; dy < destHeight; dy++) {
    for (let dx = 0; dx < destWidth; dx++) {
      const cx0 = dx - destCx
      const cy0 = dy - destCy
      const rx = (cx0 * cos - cy0 * sin) / scaleX
      const ry = (cx0 * sin + cy0 * cos) / scaleY
      const sx = Math.round(rx + srcCx)
      const sy = Math.round(ry + srcCy)
      if (sx < 0 || sx >= buffer.width || sy < 0 || sy >= buffer.height) continue
      pixels[dy * destWidth + dx] = buffer.pixels[sy * buffer.width + sx]
    }
  }

  return {
    width: destWidth,
    height: destHeight,
    originX: buffer.originX,
    originY: buffer.originY,
    pixels,
  }
}

function rotatePoint(x: number, y: number, rad: number): { x: number; y: number } {
  return {
    x: x * Math.cos(rad) - y * Math.sin(rad),
    y: x * Math.sin(rad) + y * Math.cos(rad),
  }
}
