import type { Frame, Layer, Pixel } from '../types'

/** layers[0] is the topmost layer (matches LayersPanel top-to-bottom order). */
export function compositeFrame(
  frame: Frame,
  layers: Layer[],
  width: number,
  height: number
): Pixel[] {
  const result: Pixel[] = new Array(width * height).fill(null)
  // paint from bottom layer to top layer so the topmost wins
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    if (!layer.visible) continue
    const layerPixels = frame.layerPixels[layer.id]
    if (!layerPixels) continue
    for (let idx = 0; idx < result.length; idx++) {
      if (layerPixels[idx] !== null) result[idx] = layerPixels[idx]
    }
  }
  return result
}

export function pixelsToImageData(pixels: Pixel[], width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < pixels.length; i++) {
    const color = pixels[i]
    const offset = i * 4
    if (color === null) {
      data[offset + 3] = 0
      continue
    }
    const { r, g, b, a } = hexToRgba(color)
    data[offset] = r
    data[offset + 1] = g
    data[offset + 2] = b
    data[offset + 3] = a
  }
  return new ImageData(data, width, height)
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const a = h.length >= 8 ? parseInt(h.substring(6, 8), 16) : 255
  return { r, g, b, a }
}
