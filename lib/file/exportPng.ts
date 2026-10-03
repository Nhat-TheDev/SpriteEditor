import type { Project } from '../types'
import { compositeFrame, pixelsToImageData } from '../canvas/compositing'

export function buildFrameCanvas(pixels: (string | null)[], width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.putImageData(pixelsToImageData(pixels, width, height), 0, 0)
  return canvas
}

export function buildSpritesheetCanvas(project: Project): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = project.width * project.frames.length
  canvas.height = project.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  project.frames.forEach((frame, index) => {
    const pixels = compositeFrame(frame, project.layers, project.width, project.height)
    const imageData = pixelsToImageData(pixels, project.width, project.height)
    ctx.putImageData(imageData, index * project.width, 0)
  })
  return canvas
}

export function exportFramePNG(project: Project): Promise<Blob> {
  const frame = project.frames[project.activeFrameIndex]
  const pixels = compositeFrame(frame, project.layers, project.width, project.height)
  const canvas = buildFrameCanvas(pixels, project.width, project.height)
  return canvasToBlob(canvas)
}

export function exportSpritesheetPNG(project: Project): Promise<Blob> {
  const canvas = buildSpritesheetCanvas(project)
  return canvasToBlob(canvas)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to export PNG'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
