export function screenToPixel(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  zoom: number,
  panX: number,
  panY: number
): { x: number; y: number } {
  const x = Math.floor((clientX - rect.left) / zoom - panX)
  const y = Math.floor((clientY - rect.top) / zoom - panY)
  return { x, y }
}

const MIN_ZOOM = 1
const MAX_ZOOM = 64

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}
