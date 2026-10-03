import type { Project } from '../types'

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

export function deserializeProject(json: string): Project {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid project file')
  }
  if (!isValidProject(parsed)) {
    throw new Error('Invalid project file')
  }
  // Older files predate layer opacity — default it to fully opaque.
  return {
    ...parsed,
    layers: parsed.layers.map((layer) => ({
      ...layer,
      opacity: typeof layer.opacity === 'number' && !Number.isNaN(layer.opacity)
        ? Math.min(1, Math.max(0, layer.opacity))
        : 1,
    })),
  }
}

function isValidProject(value: unknown): value is Project {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.name === 'string' &&
    typeof v.width === 'number' &&
    v.width > 0 &&
    typeof v.height === 'number' &&
    v.height > 0 &&
    typeof v.fps === 'number' &&
    Array.isArray(v.layers) &&
    Array.isArray(v.frames) &&
    typeof v.activeFrameIndex === 'number' &&
    typeof v.activeLayerId === 'string' &&
    Array.isArray(v.palette) &&
    typeof v.symmetryMode === 'string'
  )
}

export function downloadProjectFile(project: Project): void {
  const json = serializeProject(project)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name}.spritepaint.json`
  a.click()
  URL.revokeObjectURL(url)
}
