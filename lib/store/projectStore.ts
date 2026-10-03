import { create } from 'zustand'
import { createEmptyPixels, setPixelWithSymmetry, floodFill, getSymmetricPoints } from '../canvas/drawing'
import {
  clampShift,
  cutSelection,
  pasteSelection,
  pixelBounds,
  rasterizeTransform,
  type SelectionBuffer,
} from '../canvas/transform'
import type { Layer, Pixel, Project, Tool } from '../types'

/**
 * Shifts selectionOffset so one chosen point of the selection box stays put
 * while the buffer resizes. rasterizeTransform grows the buffer around its own
 * centre, but selectionOffset addresses the top-left corner, so without this
 * the selection only ever expands towards the bottom-right.
 *
 * anchorX/anchorY are normalised: 0 pins the left/top edge, 1 the right/bottom
 * edge, 0.5 the centre. A corner drag pins the opposite corner; a rotation
 * pins the centre.
 */
function anchorOffset(
  offset: { x: number; y: number },
  prev: SelectionBuffer,
  next: SelectionBuffer,
  anchorX: number,
  anchorY: number
): { x: number; y: number } {
  // Deliberately not rounded: a rotation drag re-anchors on every pointermove,
  // so rounding here accumulated half a pixel per step and visibly walked the
  // selection away from its pivot. The offset is rounded once, where pixels
  // actually have to land on the grid.
  return {
    x: offset.x + (prev.width - next.width) * anchorX,
    y: offset.y + (prev.height - next.height) * anchorY,
  }
}

/**
 * The clipboard's pixels for every layer the project has right now. A layer the
 * clipboard holds nothing for (added after the copy) comes out empty, so the
 * pasted frame is exactly the copied one rather than a mix of old and new.
 */
function clipboardLayerPixels(
  project: Project,
  clipboard: Record<string, Pixel[]>
): Record<string, Pixel[]> {
  const result: Record<string, Pixel[]> = {}
  for (const layer of project.layers) {
    const source = clipboard[layer.id]
    result[layer.id] = source ? source.slice() : createEmptyPixels(project.width, project.height)
  }
  return result
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}-${Date.now()}`
}

export function createEmptyProject(name: string, width: number, height: number): Project {
  const layer: Layer = { id: nextId('layer'), name: 'Layer 1', visible: true, opacity: 1 }
  return {
    name,
    width,
    height,
    fps: 12,
    layers: [layer],
    frames: [{ id: nextId('frame'), layerPixels: { [layer.id]: createEmptyPixels(width, height) } }],
    activeFrameIndex: 0,
    activeLayerId: layer.id,
    palette: [],
    symmetryMode: 'none',
  }
}

const HISTORY_LIMIT = 50

// Edits that throw colours away are recorded like a stroke, so Undo brings the
// palette back. Adding a colour is not: nothing is lost, and every click on
// "+" would otherwise use up one of the 50 history slots.
function replacePalette(state: ProjectStoreState, palette: string[], label: string) {
  return {
    project: { ...state.project, palette },
    history: [...state.history, state.project].slice(-HISTORY_LIMIT),
    historyLabels: [...state.historyLabels, label].slice(-HISTORY_LIMIT),
    future: [],
    isDirty: true,
  }
}

interface ProjectStoreState {
  project: Project
  // Bumped on every newProject/loadProject call, even when the new project
  // happens to have the same width/height as the previous one (e.g. the
  // default 32x32 recreated via New Project). Consumers that need to react
  // to "a different project just loaded" — like Canvas re-fitting its zoom
  // to the viewport — should key off this instead of width/height, which
  // don't change in that case.
  projectRevision: number
  activeTool: Tool
  activeColor: string
  zoom: number
  panX: number
  panY: number
  history: Project[]
  future: Project[]
  historyLabels: string[]
  isDirty: boolean
  pendingSnapshot: Project | null
  newProject: (name: string, width: number, height: number) => void
  loadProject: (project: Project) => void
  setActiveTool: (tool: Tool) => void
  setActiveColor: (color: string) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  paintAt: (x: number, y: number, color: Pixel) => void
  commitStroke: (label: string) => void
  undo: () => void
  redo: () => void
  rewindTo: (index: number) => void
  markSaved: () => void
  shapeFilled: boolean
  setShapeFilled: (filled: boolean) => void
  applyFloodFill: (x: number, y: number, color: Pixel) => void
  setSymmetryMode: (mode: Project['symmetryMode']) => void
  addLayer: () => void
  removeLayer: (id: string) => void
  toggleLayerVisibility: (id: string) => void
  setLayerOpacity: (id: string, opacity: number) => void
  renameLayer: (id: string, name: string) => void
  setActiveLayer: (id: string) => void
  reorderLayer: (fromIndex: number, toIndex: number) => void
  onionSkin: boolean
  toggleOnionSkin: () => void
  addFrame: () => void
  duplicateFrame: (index: number) => void
  /** Pixels of every layer of the last copied frame, keyed by layer id. Not saved with the project. */
  frameClipboard: Record<string, Pixel[]> | null
  copyFrame: () => void
  pasteFrame: () => void
  pasteFrameAsNew: () => void
  removeFrame: (index: number) => void
  reorderFrame: (fromIndex: number, toIndex: number) => void
  setActiveFrame: (index: number) => void
  setFps: (fps: number) => void
  moveLayerContent: (dx: number, dy: number) => void
  selection: SelectionBuffer | null
  selectionOffset: { x: number; y: number }
  preSelectionPixels: Pixel[] | null
  startLassoSelection: (polygon: { x: number; y: number }[]) => void
  moveSelection: (dx: number, dy: number) => void
  commitSelection: () => void
  cancelSelection: () => void
  selectionScaleX: number
  selectionScaleY: number
  selectionRotation: number
  originalSelectionBuffer: SelectionBuffer | null
  setSelectionScale: (scaleX: number, scaleY: number, anchorX: number, anchorY: number) => void
  refineSelection: () => void
  setSelectionRotation: (radians: number) => void
  addPaletteColor: (color: string) => void
  removePaletteColor: (color: string) => void
  setPalette: (colors: string[], label?: string) => void
  renameProject: (name: string) => void
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: createEmptyProject('Untitled', 32, 32),
  projectRevision: 0,
  activeTool: 'pencil',
  activeColor: '#808080',
  zoom: 8,
  panX: 0,
  panY: 0,
  history: [],
  future: [],
  historyLabels: [],
  isDirty: false,
  pendingSnapshot: null,
  frameClipboard: null,

  newProject: (name, width, height) =>
    set((state) => ({
      project: createEmptyProject(name, width, height),
      projectRevision: state.projectRevision + 1,
      zoom: 8,
      panX: 0,
      panY: 0,
      activeTool: 'pencil',
      activeColor: '#808080',
      history: [],
      future: [],
      historyLabels: [],
      isDirty: false,
      pendingSnapshot: null,
      frameClipboard: null,
      selection: null,
      selectionOffset: { x: 0, y: 0 },
      preSelectionPixels: null,
      selectionScaleX: 1,
      selectionScaleY: 1,
      selectionRotation: 0,
      originalSelectionBuffer: null,
    })),

  loadProject: (project) =>
    set((state) => ({
      project,
      projectRevision: state.projectRevision + 1,
      history: [],
      future: [],
      historyLabels: [],
      isDirty: false,
      pendingSnapshot: null,
      frameClipboard: null,
      selection: null,
      selectionOffset: { x: 0, y: 0 },
      preSelectionPixels: null,
      selectionScaleX: 1,
      selectionScaleY: 1,
      selectionRotation: 0,
      originalSelectionBuffer: null,
    })),

  setActiveTool: (tool) => {
    // A floating selection's pixels have already been cut out of the layer, so
    // switching to a tool that cannot put them back would strand — and
    // effectively delete — them. Lasso and move both still drag the selection,
    // so they keep it alive; everything else commits it first.
    if (tool !== 'lasso' && tool !== 'move' && get().selection) get().commitSelection()
    set({ activeTool: tool })
  },
  setActiveColor: (color) => set({ activeColor: color }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (x, y) => set({ panX: x, panY: y }),

  paintAt: (x, y, color) =>
    set((state) => {
      const { project } = state
      const frame = project.frames[project.activeFrameIndex]
      const layerId = project.activeLayerId
      const currentPixels = frame.layerPixels[layerId]
      const nextPixels = setPixelWithSymmetry(
        currentPixels,
        project.width,
        project.height,
        x,
        y,
        color,
        project.symmetryMode
      )
      const nextFrame = { ...frame, layerPixels: { ...frame.layerPixels, [layerId]: nextPixels } }
      const nextFrames = project.frames.map((f, i) => (i === project.activeFrameIndex ? nextFrame : f))
      return {
        project: { ...project, frames: nextFrames },
        pendingSnapshot: state.pendingSnapshot ?? project,
      }
    }),

  commitStroke: (label) =>
    set((state) => {
      const snapshot = state.pendingSnapshot ?? state.project
      const history = [...state.history, snapshot].slice(-HISTORY_LIMIT)
      const historyLabels = [...state.historyLabels, label].slice(-HISTORY_LIMIT)
      return { history, historyLabels, future: [], isDirty: true, pendingSnapshot: null }
    }),

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state
      const previous = state.history[state.history.length - 1]
      return {
        project: previous,
        history: state.history.slice(0, -1),
        historyLabels: state.historyLabels.slice(0, -1),
        future: [state.project, ...state.future],
      }
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state
      const [next, ...rest] = state.future
      return {
        project: next,
        future: rest,
        history: [...state.history, state.project],
        historyLabels: [...state.historyLabels, 'Redo'],
      }
    }),

  // history[i] holds the state BEFORE action i (needed for undo); the state
  // AFTER action i — what rewindTo(i) should jump to — is therefore
  // history[i + 1], or the current project when i is the most recent action.
  rewindTo: (index) =>
    set((state) => {
      if (index < 0 || index >= state.historyLabels.length) return state
      const target = index + 1 < state.history.length ? state.history[index + 1] : state.project
      return {
        project: target,
        history: state.history.slice(0, index + 1),
        historyLabels: state.historyLabels.slice(0, index + 1),
        future: [],
        pendingSnapshot: null,
      }
    }),

  markSaved: () => set({ isDirty: false }),

  shapeFilled: false,
  setShapeFilled: (filled) => set({ shapeFilled: filled }),

  applyFloodFill: (x, y, color) =>
    set((state) => {
      const { project } = state
      const frame = project.frames[project.activeFrameIndex]
      const layerId = project.activeLayerId
      let pixels = frame.layerPixels[layerId]
      const seeds = [{ x, y }, ...getSymmetricPoints(x, y, project.width, project.height, project.symmetryMode)]
      for (const seed of seeds) {
        pixels = floodFill(pixels, project.width, project.height, seed.x, seed.y, color)
      }
      const nextFrame = { ...frame, layerPixels: { ...frame.layerPixels, [layerId]: pixels } }
      const nextFrames = project.frames.map((f, i) => (i === project.activeFrameIndex ? nextFrame : f))
      return {
        project: { ...project, frames: nextFrames },
        pendingSnapshot: state.pendingSnapshot ?? project,
      }
    }),

  setSymmetryMode: (mode) => set((state) => ({ project: { ...state.project, symmetryMode: mode } })),

  // View preference, not project data: it is not saved with the file and does
  // not reset when a new project is created, the same way zoom does not.
  onionSkin: false,
  toggleOnionSkin: () => set((state) => ({ onionSkin: !state.onionSkin })),

  reorderLayer: (fromIndex, toIndex) =>
    set((state) => {
      const { project } = state
      if (toIndex < 0 || toIndex >= project.layers.length) return state
      const layers = project.layers.slice()
      const [moved] = layers.splice(fromIndex, 1)
      layers.splice(toIndex, 0, moved)
      return { project: { ...project, layers } }
    }),

  addLayer: () =>
    set((state) => {
      const { project } = state
      const layer: Layer = { id: nextId('layer'), name: `Layer ${project.layers.length + 1}`, visible: true, opacity: 1 }
      const nextLayers = [...project.layers, layer]
      const nextFrames = project.frames.map((f) => ({
        ...f,
        layerPixels: { ...f.layerPixels, [layer.id]: createEmptyPixels(project.width, project.height) },
      }))
      return { project: { ...project, layers: nextLayers, frames: nextFrames, activeLayerId: layer.id } }
    }),

  removeLayer: (id) =>
    set((state) => {
      const { project } = state
      if (project.layers.length <= 1) return state
      const nextLayers = project.layers.filter((l) => l.id !== id)
      const nextFrames = project.frames.map((f) => {
        const rest = { ...f.layerPixels }
        delete rest[id]
        return { ...f, layerPixels: rest }
      })
      const activeLayerId = project.activeLayerId === id ? nextLayers[0].id : project.activeLayerId
      return { project: { ...project, layers: nextLayers, frames: nextFrames, activeLayerId } }
    }),

  toggleLayerVisibility: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      },
    })),

  setLayerOpacity: (id, opacity) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) =>
          l.id === id ? { ...l, opacity: Math.min(1, Math.max(0, opacity)) } : l
        ),
      },
      isDirty: true,
    })),

  renameLayer: (id, name) =>
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((l) => (l.id === id ? { ...l, name } : l)),
      },
    })),

  setActiveLayer: (id) => set((state) => ({ project: { ...state.project, activeLayerId: id } })),

  addFrame: () =>
    set((state) => {
      const { project } = state
      const layerPixels: Record<string, Pixel[]> = {}
      for (const layer of project.layers) {
        layerPixels[layer.id] = createEmptyPixels(project.width, project.height)
      }
      const nextFrames = [...project.frames, { id: nextId('frame'), layerPixels }]
      return { project: { ...project, frames: nextFrames, activeFrameIndex: nextFrames.length - 1 } }
    }),

  duplicateFrame: (index) =>
    set((state) => {
      const { project } = state
      const source = project.frames[index]
      if (!source) return state
      const copy = {
        id: nextId('frame'),
        layerPixels: Object.fromEntries(
          Object.entries(source.layerPixels).map(([layerId, pixels]) => [layerId, pixels.slice()])
        ),
      }
      const nextFrames = [...project.frames.slice(0, index + 1), copy, ...project.frames.slice(index + 1)]
      return { project: { ...project, frames: nextFrames, activeFrameIndex: index + 1 } }
    }),

  copyFrame: () => {
    // A floating lasso selection has already been cut out of its layer; settle
    // it first so the copy includes those pixels rather than the hole.
    if (get().selection) get().commitSelection()
    const { project } = get()
    const frame = project.frames[project.activeFrameIndex]
    if (!frame) return
    set({
      frameClipboard: Object.fromEntries(
        Object.entries(frame.layerPixels).map(([layerId, pixels]) => [layerId, pixels.slice()])
      ),
    })
  },

  pasteFrame: () => {
    if (get().selection) get().commitSelection()
    set((state) => {
      const { project, frameClipboard } = state
      if (!frameClipboard) return state
      const layerPixels = clipboardLayerPixels(project, frameClipboard)
      const frames = project.frames.map((f, i) => (i === project.activeFrameIndex ? { ...f, layerPixels } : f))
      return {
        project: { ...project, frames },
        history: [...state.history, project].slice(-HISTORY_LIMIT),
        historyLabels: [...state.historyLabels, 'Paste frame'].slice(-HISTORY_LIMIT),
        future: [],
        isDirty: true,
      }
    })
  },

  pasteFrameAsNew: () => {
    if (get().selection) get().commitSelection()
    set((state) => {
      const { project, frameClipboard } = state
      if (!frameClipboard) return state
      const at = project.activeFrameIndex + 1
      const created = { id: nextId('frame'), layerPixels: clipboardLayerPixels(project, frameClipboard) }
      const frames = [...project.frames.slice(0, at), created, ...project.frames.slice(at)]
      return {
        project: { ...project, frames, activeFrameIndex: at },
        history: [...state.history, project].slice(-HISTORY_LIMIT),
        historyLabels: [...state.historyLabels, 'Paste frame as new'].slice(-HISTORY_LIMIT),
        future: [],
        isDirty: true,
      }
    })
  },

  removeFrame: (index) =>
    set((state) => {
      const { project } = state
      if (project.frames.length <= 1) return state
      const nextFrames = project.frames.filter((_, i) => i !== index)
      const activeFrameIndex = Math.min(project.activeFrameIndex, nextFrames.length - 1)
      return { project: { ...project, frames: nextFrames, activeFrameIndex } }
    }),

  reorderFrame: (fromIndex, toIndex) =>
    set((state) => {
      const { project } = state
      const frames = project.frames.slice()
      const [moved] = frames.splice(fromIndex, 1)
      frames.splice(toIndex, 0, moved)
      return { project: { ...project, frames, activeFrameIndex: toIndex } }
    }),

  setActiveFrame: (index) => set((state) => ({ project: { ...state.project, activeFrameIndex: index } })),

  setFps: (fps) => set((state) => ({ project: { ...state.project, fps } })),

  moveLayerContent: (dx, dy) =>
    set((state) => {
      const { project } = state
      const frame = project.frames[project.activeFrameIndex]
      const layerId = project.activeLayerId
      const source = frame.layerPixels[layerId]
      // Stop the content at the canvas edge rather than pushing pixels off it:
      // a pixel that leaves the canvas is cut off for good, and dragging back
      // cannot bring it home. The limit comes from the layer's bounding box.
      const bounds = pixelBounds(source, project.width, project.height)
      if (!bounds) return state
      const { minX, maxX, minY, maxY } = bounds
      const shiftX = clampShift(dx, minX, maxX - minX + 1, project.width)
      const shiftY = clampShift(dy, minY, maxY - minY + 1, project.height)
      if (shiftX === 0 && shiftY === 0) return state
      const next: Pixel[] = new Array(project.width * project.height).fill(null)
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const color = source[y * project.width + x]
          if (color === null) continue
          next[(y + shiftY) * project.width + x + shiftX] = color
        }
      }
      const nextFrame = { ...frame, layerPixels: { ...frame.layerPixels, [layerId]: next } }
      const nextFrames = project.frames.map((f, i) => (i === project.activeFrameIndex ? nextFrame : f))
      return {
        project: { ...project, frames: nextFrames },
        pendingSnapshot: state.pendingSnapshot ?? project,
      }
    }),

  selection: null,
  selectionOffset: { x: 0, y: 0 },
  preSelectionPixels: null,

  startLassoSelection: (polygon) =>
    set((state) => {
      const { project } = state
      const frame = project.frames[project.activeFrameIndex]
      const layerId = project.activeLayerId
      const pixels = frame.layerPixels[layerId]
      const { remaining, buffer } = cutSelection(pixels, project.width, project.height, polygon)
      const nextFrame = { ...frame, layerPixels: { ...frame.layerPixels, [layerId]: remaining } }
      const nextFrames = project.frames.map((f, i) => (i === project.activeFrameIndex ? nextFrame : f))
      return {
        project: { ...project, frames: nextFrames },
        selection: buffer,
        originalSelectionBuffer: buffer,
        selectionOffset: { x: buffer.originX, y: buffer.originY },
        selectionScaleX: 1,
        selectionScaleY: 1,
        selectionRotation: 0,
        preSelectionPixels: pixels,
        // Snapshot the project as it was BEFORE the cut, so undoing the
        // committed transform restores the original pixels instead of the
        // hole the cut left behind.
        pendingSnapshot: state.pendingSnapshot ?? project,
      }
    }),

  moveSelection: (dx, dy) =>
    set((state) => {
      const { selection, selectionOffset, project } = state
      // Same rule as moveLayerContent: committing clips whatever hangs off the
      // canvas, so keep the selection on it. The limit is the painted pixels,
      // not the buffer: a lasso drawn loosely has an empty margin that must be
      // free to hang over the edge, or the content could never reach it.
      if (!selection) return state
      const { minX, maxX, minY, maxY } = pixelBounds(selection.pixels, selection.width, selection.height) ?? {
        minX: 0,
        maxX: selection.width - 1,
        minY: 0,
        maxY: selection.height - 1,
      }
      return {
        selectionOffset: {
          x: selectionOffset.x + clampShift(dx, selectionOffset.x + minX, maxX - minX + 1, project.width),
          y: selectionOffset.y + clampShift(dy, selectionOffset.y + minY, maxY - minY + 1, project.height),
        },
      }
    }),

  commitSelection: () =>
    set((state) => {
      const { project, selection, selectionOffset } = state
      if (!selection) return state
      const frame = project.frames[project.activeFrameIndex]
      const layerId = project.activeLayerId
      const pixels = frame.layerPixels[layerId]
      const pasted = pasteSelection(
        pixels,
        project.width,
        project.height,
        selection,
        Math.round(selectionOffset.x),
        Math.round(selectionOffset.y)
      )
      const nextFrame = { ...frame, layerPixels: { ...frame.layerPixels, [layerId]: pasted } }
      const nextFrames = project.frames.map((f, i) => (i === project.activeFrameIndex ? nextFrame : f))
      return {
        project: { ...project, frames: nextFrames },
        selection: null,
        originalSelectionBuffer: null,
        preSelectionPixels: null,
        history: [...state.history, state.pendingSnapshot ?? state.project].slice(-HISTORY_LIMIT),
        historyLabels: [...state.historyLabels, 'Transform'].slice(-HISTORY_LIMIT),
        future: [],
        isDirty: true,
        pendingSnapshot: null,
        selectionScaleX: 1,
        selectionScaleY: 1,
        selectionRotation: 0,
      }
    }),

  cancelSelection: () =>
    set((state) => {
      const { project, preSelectionPixels } = state
      if (!preSelectionPixels) {
        return { selection: null, originalSelectionBuffer: null, pendingSnapshot: null }
      }
      const frame = project.frames[project.activeFrameIndex]
      const layerId = project.activeLayerId
      const nextFrame = { ...frame, layerPixels: { ...frame.layerPixels, [layerId]: preSelectionPixels } }
      const nextFrames = project.frames.map((f, i) => (i === project.activeFrameIndex ? nextFrame : f))
      return {
        project: { ...project, frames: nextFrames },
        selection: null,
        originalSelectionBuffer: null,
        preSelectionPixels: null,
        pendingSnapshot: null,
        selectionScaleX: 1,
        selectionScaleY: 1,
        selectionRotation: 0,
      }
    }),

  selectionScaleX: 1,

  selectionScaleY: 1,
  selectionRotation: 0,
  originalSelectionBuffer: null,

  setSelectionScale: (scaleX, scaleY, anchorX, anchorY) =>
    set((state) => {
      if (!state.originalSelectionBuffer || !state.selection) return state
      // fast while the handle is being dragged; refineSelection re-runs the
      // quality path once the pointer is released
      const next = rasterizeTransform(state.originalSelectionBuffer, scaleX, scaleY, state.selectionRotation, {
        fast: true,
      })
      return {
        selectionScaleX: scaleX,
        selectionScaleY: scaleY,
        selection: next,
        selectionOffset: anchorOffset(state.selectionOffset, state.selection, next, anchorX, anchorY),
      }
    }),

  setSelectionRotation: (radians) =>
    set((state) => {
      if (!state.originalSelectionBuffer || !state.selection) return state
      const next = rasterizeTransform(
        state.originalSelectionBuffer,
        state.selectionScaleX,
        state.selectionScaleY,
        radians,
        { fast: true }
      )
      return {
        selectionRotation: radians,
        selection: next,
        // rotation pivots on the centre, so that is what has to stay put
        selectionOffset: anchorOffset(state.selectionOffset, state.selection, next, 0.5, 0.5),
      }
    }),

  refineSelection: () =>
    set((state) => {
      if (!state.originalSelectionBuffer || !state.selection) return state
      const next = rasterizeTransform(
        state.originalSelectionBuffer,
        state.selectionScaleX,
        state.selectionScaleY,
        state.selectionRotation
      )
      return {
        selection: next,
        // the quality path can land on a slightly different size than the draft,
        // so settle it symmetrically rather than letting it jump to one side
        selectionOffset: anchorOffset(state.selectionOffset, state.selection, next, 0.5, 0.5),
      }
    }),

  addPaletteColor: (color) =>
    set((state) => {
      if (state.project.palette.includes(color)) return state
      return { project: { ...state.project, palette: [...state.project.palette, color] } }
    }),

  removePaletteColor: (color) =>
    set((state) => {
      if (!state.project.palette.includes(color)) return state
      return replacePalette(
        state,
        state.project.palette.filter((c) => c !== color),
        'Remove colour'
      )
    }),

  setPalette: (colors, label = 'Change palette') =>
    set((state) => {
      const current = state.project.palette
      if (colors.length === current.length && colors.every((c, i) => c === current[i])) return state
      return replacePalette(state, colors, label)
    }),

  renameProject: (name) => set((state) => ({ project: { ...state.project, name } })),
}))
