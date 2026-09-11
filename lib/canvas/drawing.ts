import type { Pixel, SymmetryMode } from '../types'

export function createEmptyPixels(width: number, height: number): Pixel[] {
  return new Array(width * height).fill(null)
}

export function pixelIndex(x: number, y: number, width: number): number {
  return y * width + x
}

export function getSymmetricPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  mode: SymmetryMode
): { x: number; y: number }[] {
  const mirrorX = width - 1 - x
  const mirrorY = height - 1 - y
  const points: { x: number; y: number }[] = []
  const pushIfDistinct = (px: number, py: number) => {
    if (px !== x || py !== y) points.push({ x: px, y: py })
  }

  if (mode === 'x' || mode === 'xy') pushIfDistinct(mirrorX, y)
  if (mode === 'y' || mode === 'xy') pushIfDistinct(x, mirrorY)
  if (mode === 'xy') pushIfDistinct(mirrorX, mirrorY)

  // de-dupe (can happen on the exact center pixel for 'xy')
  const seen = new Set<string>()
  return points.filter((p) => {
    const key = `${p.x},${p.y}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function setPixelWithSymmetry(
  pixels: Pixel[],
  width: number,
  height: number,
  x: number,
  y: number,
  color: Pixel,
  mode: SymmetryMode
): Pixel[] {
  const next = pixels.slice()
  next[pixelIndex(x, y, width)] = color
  for (const p of getSymmetricPoints(x, y, width, height, mode)) {
    next[pixelIndex(p.x, p.y, width)] = color
  }
  return next
}

export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy

  while (true) {
    points.push({ x, y })
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
  return points
}

export function rectanglePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean
): { x: number; y: number }[] {
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minY = Math.min(y0, y1)
  const maxY = Math.max(y0, y1)
  const points: { x: number; y: number }[] = []

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const onBorder = x === minX || x === maxX || y === minY || y === maxY
      if (filled || onBorder) points.push({ x, y })
    }
  }
  return points
}

export function midpointEllipsePoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  filled: boolean
): { x: number; y: number }[] {
  const points = new Set<string>()
  const add = (x: number, y: number) => points.add(`${x},${y}`)

  const addQuadrantOrSpan = (x: number, y: number) => {
    if (filled) {
      for (let fx = cx - x; fx <= cx + x; fx++) {
        add(fx, cy - y)
        add(fx, cy + y)
      }
    } else {
      add(cx + x, cy + y)
      add(cx - x, cy + y)
      add(cx + x, cy - y)
      add(cx - x, cy - y)
    }
  }

  let x = 0
  let y = ry
  const rx2 = rx * rx
  const ry2 = ry * ry
  const twoRx2 = 2 * rx2
  const twoRy2 = 2 * ry2
  let p1 = ry2 - rx2 * ry + 0.25 * rx2
  let dx = twoRy2 * x
  let dy = twoRx2 * y

  while (dx < dy) {
    addQuadrantOrSpan(x, y)
    x++
    dx += twoRy2
    if (p1 < 0) {
      p1 += dx + ry2
    } else {
      y--
      dy -= twoRx2
      p1 += dx - dy + ry2
    }
  }

  let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2
  while (y >= 0) {
    addQuadrantOrSpan(x, y)
    y--
    dy -= twoRx2
    if (p2 > 0) {
      p2 += rx2 - dy
    } else {
      x++
      dx += twoRy2
      p2 += dx - dy + rx2
    }
  }

  return Array.from(points).map((key) => {
    const [px, py] = key.split(',').map(Number)
    return { x: px, y: py }
  })
}

export function floodFill(
  pixels: Pixel[],
  width: number,
  height: number,
  x: number,
  y: number,
  color: Pixel
): Pixel[] {
  const next = pixels.slice()
  const startIdx = pixelIndex(x, y, width)
  const targetColor = next[startIdx]
  if (targetColor === color) return next

  const stack: { x: number; y: number }[] = [{ x, y }]
  while (stack.length > 0) {
    const p = stack.pop()!
    if (p.x < 0 || p.x >= width || p.y < 0 || p.y >= height) continue
    const idx = pixelIndex(p.x, p.y, width)
    if (next[idx] !== targetColor) continue
    next[idx] = color
    stack.push({ x: p.x + 1, y: p.y })
    stack.push({ x: p.x - 1, y: p.y })
    stack.push({ x: p.x, y: p.y + 1 })
    stack.push({ x: p.x, y: p.y - 1 })
  }
  return next
}
