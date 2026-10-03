import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore, createEmptyProject } from './projectStore'

describe('createEmptyProject', () => {
  it('creates a project with one layer, one frame, all-transparent pixels', () => {
    const project = createEmptyProject('Test', 4, 4)
    expect(project.width).toBe(4)
    expect(project.height).toBe(4)
    expect(project.layers).toHaveLength(1)
    expect(project.frames).toHaveLength(1)
    const layerId = project.layers[0].id
    expect(project.frames[0].layerPixels[layerId]).toHaveLength(16)
    expect(project.activeLayerId).toBe(layerId)
    expect(project.activeFrameIndex).toBe(0)
    expect(project.symmetryMode).toBe('none')
  })
})

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Reset', 8, 8)
  })

  it('newProject replaces the current project', () => {
    useProjectStore.getState().newProject('Hero', 16, 16)
    const { project } = useProjectStore.getState()
    expect(project.name).toBe('Hero')
    expect(project.width).toBe(16)
  })

  it('setActiveTool updates activeTool', () => {
    useProjectStore.getState().setActiveTool('fill')
    expect(useProjectStore.getState().activeTool).toBe('fill')
  })

  it('setActiveColor updates activeColor', () => {
    useProjectStore.getState().setActiveColor('#123456')
    expect(useProjectStore.getState().activeColor).toBe('#123456')
  })

  it('defaults activeTool to pencil and activeColor to 50% lightness gray', () => {
    useProjectStore.getState().newProject('Fresh', 4, 4)
    expect(useProjectStore.getState().activeTool).toBe('pencil')
    expect(useProjectStore.getState().activeColor).toBe('#808080')
  })
})

describe('paintAt + commitStroke + history', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Hist', 4, 4)
  })

  it('paintAt sets a pixel on the active layer of the active frame without pushing history', () => {
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    const { project, history } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][0]).toBe('#ff0000')
    expect(history).toHaveLength(0)
  })

  it('commitStroke pushes a labeled snapshot and marks dirty', () => {
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    const { history, historyLabels, isDirty } = useProjectStore.getState()
    expect(history).toHaveLength(1)
    expect(historyLabels).toEqual(['Pencil'])
    expect(isDirty).toBe(true)
  })

  it('undo restores the previous snapshot and populates future', () => {
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().paintAt(1, 1, '#00ff00')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().undo()
    const { project, history, future } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][pixelIdx(1, 1, 4)]).toBeNull()
    expect(history).toHaveLength(1)
    expect(future).toHaveLength(1)
  })

  it('redo re-applies the undone snapshot', () => {
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().undo()
    useProjectStore.getState().redo()
    const { project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][0]).toBe('#ff0000')
  })

  it('rewindTo jumps directly to an earlier history entry', () => {
    useProjectStore.getState().paintAt(0, 0, '#111111')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().paintAt(1, 0, '#222222')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().paintAt(2, 0, '#333333')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().rewindTo(0)
    const { project, history } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][0]).toBe('#111111')
    expect(project.frames[0].layerPixels[layerId][1]).toBeNull()
    expect(history).toHaveLength(1)
  })

  it('caps history at 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      useProjectStore.getState().paintAt(0, 0, '#000000')
      useProjectStore.getState().commitStroke('Pencil')
    }
    expect(useProjectStore.getState().history.length).toBeLessThanOrEqual(50)
  })

  it('markSaved clears isDirty', () => {
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().markSaved()
    expect(useProjectStore.getState().isDirty).toBe(false)
  })
})

function pixelIdx(x: number, y: number, width: number): number {
  return y * width + x
}

describe('shapeFilled toggle', () => {
  it('defaults to false and can be toggled', () => {
    expect(useProjectStore.getState().shapeFilled).toBe(false)
    useProjectStore.getState().setShapeFilled(true)
    expect(useProjectStore.getState().shapeFilled).toBe(true)
  })
})

describe('applyFloodFill', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Fill', 4, 4)
  })

  it('flood-fills the active layer from the given seed', () => {
    useProjectStore.getState().applyFloodFill(0, 0, '#00ff00')
    const { project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId].every((p) => p === '#00ff00')).toBe(true)
  })

  it('mirrors the fill seed when symmetry is x', () => {
    useProjectStore.setState((state) => ({ project: { ...state.project, symmetryMode: 'x' } }))
    // pre-paint a vertical wall down the middle so the fill only floods the left half
    useProjectStore.getState().paintAt(2, 0, '#000000')
    useProjectStore.getState().paintAt(2, 1, '#000000')
    useProjectStore.getState().paintAt(2, 2, '#000000')
    useProjectStore.getState().paintAt(2, 3, '#000000')
    useProjectStore.getState().applyFloodFill(0, 0, '#00ff00')
    const { project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    const pixels = project.frames[0].layerPixels[layerId]
    expect(pixels[0]).toBe('#00ff00') // left half filled directly
    expect(pixels[3]).toBe('#00ff00') // right half filled via mirrored seed (3,0)
  })
})

describe('setSymmetryMode', () => {
  it('updates project.symmetryMode', () => {
    useProjectStore.getState().newProject('Sym', 8, 8)
    useProjectStore.getState().setSymmetryMode('xy')
    expect(useProjectStore.getState().project.symmetryMode).toBe('xy')
  })
})

describe('layer actions', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Layers', 4, 4)
  })

  it('addLayer appends a new visible layer and makes it active', () => {
    const before = useProjectStore.getState().project.layers.length
    useProjectStore.getState().addLayer()
    const { project } = useProjectStore.getState()
    expect(project.layers).toHaveLength(before + 1)
    expect(project.activeLayerId).toBe(project.layers[project.layers.length - 1].id)
    const newLayerId = project.activeLayerId
    expect(project.frames[0].layerPixels[newLayerId]).toHaveLength(16)
  })

  it('removeLayer deletes the layer and its pixel data from every frame', () => {
    useProjectStore.getState().addLayer()
    const secondLayerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().removeLayer(secondLayerId)
    const { project } = useProjectStore.getState()
    expect(project.layers.find((l) => l.id === secondLayerId)).toBeUndefined()
    expect(project.frames[0].layerPixels[secondLayerId]).toBeUndefined()
  })

  it('removeLayer is a no-op when it is the last remaining layer', () => {
    const { project: before } = useProjectStore.getState()
    useProjectStore.getState().removeLayer(before.layers[0].id)
    expect(useProjectStore.getState().project.layers).toHaveLength(1)
  })

  it('toggleLayerVisibility flips the visible flag', () => {
    const layerId = useProjectStore.getState().project.layers[0].id
    useProjectStore.getState().toggleLayerVisibility(layerId)
    expect(useProjectStore.getState().project.layers[0].visible).toBe(false)
  })

  it('renameLayer updates the layer name', () => {
    const layerId = useProjectStore.getState().project.layers[0].id
    useProjectStore.getState().renameLayer(layerId, 'Outline')
    expect(useProjectStore.getState().project.layers[0].name).toBe('Outline')
  })

  it('setActiveLayer updates activeLayerId', () => {
    useProjectStore.getState().addLayer()
    const layers = useProjectStore.getState().project.layers
    useProjectStore.getState().setActiveLayer(layers[0].id)
    expect(useProjectStore.getState().project.activeLayerId).toBe(layers[0].id)
  })
})

describe('frame actions', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Frames', 2, 2)
  })

  it('addFrame appends an empty frame and makes it active', () => {
    useProjectStore.getState().addFrame()
    const { project } = useProjectStore.getState()
    expect(project.frames).toHaveLength(2)
    expect(project.activeFrameIndex).toBe(1)
    const layerId = project.activeLayerId
    expect(project.frames[1].layerPixels[layerId].every((p) => p === null)).toBe(true)
  })

  it('duplicateFrame copies pixel data into a new frame right after the source', () => {
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().duplicateFrame(0)
    const { project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames).toHaveLength(2)
    expect(project.frames[1].layerPixels[layerId][0]).toBe('#ff0000')
    expect(project.activeFrameIndex).toBe(1)
  })

  it('removeFrame deletes a frame but never the last one', () => {
    useProjectStore.getState().addFrame()
    useProjectStore.getState().removeFrame(1)
    expect(useProjectStore.getState().project.frames).toHaveLength(1)
    useProjectStore.getState().removeFrame(0)
    expect(useProjectStore.getState().project.frames).toHaveLength(1)
  })

  it('reorderFrame moves a frame to a new index', () => {
    useProjectStore.getState().paintAt(0, 0, '#111111')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().addFrame() // frame 1 is now empty & active
    useProjectStore.getState().reorderFrame(1, 0)
    const { project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[1].layerPixels[layerId][0]).toBe('#111111')
  })

  it('setActiveFrame updates activeFrameIndex', () => {
    useProjectStore.getState().addFrame()
    useProjectStore.getState().setActiveFrame(0)
    expect(useProjectStore.getState().project.activeFrameIndex).toBe(0)
  })

  it('setFps updates project.fps', () => {
    useProjectStore.getState().setFps(24)
    expect(useProjectStore.getState().project.fps).toBe(24)
  })
})

describe('moveLayerContent', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Move', 4, 4)
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
  })

  it('shifts the active layer pixels by dx/dy, leaving vacated cells transparent', () => {
    useProjectStore.getState().moveLayerContent(1, 1)
    const { project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    const pixels = project.frames[0].layerPixels[layerId]
    expect(pixels[0]).toBeNull()
    expect(pixels[1 * 4 + 1]).toBe('#ff0000')
  })

  const pixelsNow = () => {
    const { project } = useProjectStore.getState()
    return project.frames[0].layerPixels[project.activeLayerId]
  }
  const filled = () => pixelsNow().flatMap((p, i) => (p === null ? [] : [i]))

  it('stops a block at the canvas edge instead of cutting it off', () => {
    useProjectStore.getState().moveLayerContent(-1, -1)
    expect(filled()).toEqual([0])
  })

  it('moves a block as far as the edge and no further', () => {
    useProjectStore.getState().paintAt(1, 0, '#00ff00')
    useProjectStore.getState().moveLayerContent(5, 0)
    // a two-pixel-wide block on a 4-wide canvas stops with its right edge on column 3
    expect(filled()).toEqual([2, 3])
  })

  it('limits each axis on its own', () => {
    useProjectStore.getState().paintAt(1, 0, '#00ff00')
    useProjectStore.getState().moveLayerContent(5, 1)
    expect(filled()).toEqual([1 * 4 + 2, 1 * 4 + 3])
  })

  it('lets the block come straight back after being held at the edge', () => {
    useProjectStore.getState().moveLayerContent(10, 0)
    expect(filled()).toEqual([3])
    // the overshoot is not remembered, so reversing moves it at once
    useProjectStore.getState().moveLayerContent(-1, 0)
    expect(filled()).toEqual([2])
  })

  it('measures the edge from the whole layer, not from one pixel', () => {
    useProjectStore.getState().paintAt(3, 3, '#00ff00')
    useProjectStore.getState().moveLayerContent(1, 1)
    // the block already spans the canvas, so there is no room to move
    expect(filled()).toEqual([0, 3 * 4 + 3])
  })

  it('does nothing on an empty layer', () => {
    useProjectStore.getState().newProject('Empty', 4, 4)
    useProjectStore.getState().moveLayerContent(2, 2)
    expect(filled()).toEqual([])
  })

  it('undoes a drag back to the layer as it was before it', () => {
    useProjectStore.getState().moveLayerContent(1, 1)
    useProjectStore.getState().commitStroke('Move')
    useProjectStore.getState().undo()
    expect(filled()).toEqual([0])
  })
})

describe('lasso selection (move-only)', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Lasso', 4, 4)
    useProjectStore.getState().paintAt(1, 1, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
  })

  it('startLassoSelection cuts the polygon into a floating selection', () => {
    useProjectStore.getState().startLassoSelection([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ])
    const { project, selection } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][1 * 4 + 1]).toBeNull()
    expect(selection).not.toBeNull()
  })

  it('moveSelection updates selectionOffset without touching the layer yet', () => {
    useProjectStore.getState().startLassoSelection([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
    ])
    useProjectStore.getState().moveSelection(1, 0)
    // offset starts at the buffer's origin (1,1) and moveSelection applies a relative delta
    expect(useProjectStore.getState().selectionOffset).toEqual({ x: 2, y: 1 })
  })

  it('moveSelection stops the painted pixels at the canvas edge, not the empty margin around them', () => {
    // 2x2 buffer with a single painted pixel in its top-left cell: the buffer
    // may hang one cell over the right and bottom edge so that pixel reaches column 3
    useProjectStore.getState().startLassoSelection([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
    ])
    useProjectStore.getState().moveSelection(10, 10)
    expect(useProjectStore.getState().selectionOffset).toEqual({ x: 3, y: 3 })
    useProjectStore.getState().moveSelection(-10, -10)
    expect(useProjectStore.getState().selectionOffset).toEqual({ x: 0, y: 0 })
  })

  it('commitSelection keeps every pixel of a selection that was pushed against the edge', () => {
    useProjectStore.getState().startLassoSelection([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
    ])
    useProjectStore.getState().moveSelection(10, 0)
    useProjectStore.getState().commitSelection()
    const { project } = useProjectStore.getState()
    const pixels = project.frames[0].layerPixels[project.activeLayerId]
    expect(pixels[1 * 4 + 3]).toBe('#ff0000')
  })

  it('commitSelection pastes the buffer at the offset and clears selection state', () => {
    useProjectStore.getState().startLassoSelection([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
    ])
    useProjectStore.getState().moveSelection(1, 0)
    useProjectStore.getState().commitSelection()
    const { project, selection, historyLabels } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][1 * 4 + 2]).toBe('#ff0000')
    expect(selection).toBeNull()
    expect(historyLabels).toEqual(['Pencil', 'Transform'])
  })

  it('cancelSelection restores the original pixels and clears selection state', () => {
    useProjectStore.getState().startLassoSelection([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
    ])
    useProjectStore.getState().moveSelection(1, 0)
    useProjectStore.getState().cancelSelection()
    const { project, selection } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][1 * 4 + 1]).toBe('#ff0000')
    expect(selection).toBeNull()
  })
})

describe('selection scale/rotation state', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('LassoXform', 8, 8)
    useProjectStore.getState().paintAt(2, 2, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().startLassoSelection([
      { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 },
    ])
  })

  it('setSelectionScale and setSelectionRotation update state and re-rasterize the selection buffer', () => {
    const originalWidth = useProjectStore.getState().selection!.width
    useProjectStore.getState().setSelectionScale(2, 2, 0.5, 0.5)
    expect(useProjectStore.getState().selectionScaleX).toBe(2)
    expect(useProjectStore.getState().selection!.width).toBeGreaterThan(originalWidth)
  })

  it('scaling keeps the selection centred instead of only growing bottom-right', () => {
    const before = useProjectStore.getState()
    const centerX = before.selectionOffset.x + before.selection!.width / 2
    const centerY = before.selectionOffset.y + before.selection!.height / 2

    useProjectStore.getState().setSelectionScale(3, 3, 0.5, 0.5)

    const after = useProjectStore.getState()
    const nextCenterX = after.selectionOffset.x + after.selection!.width / 2
    const nextCenterY = after.selectionOffset.y + after.selection!.height / 2
    // half-pixel drift is expected from rounding an odd size change
    expect(Math.abs(nextCenterX - centerX)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(nextCenterY - centerY)).toBeLessThanOrEqual(0.5)
  })

  it('switching away from the lasso commits the floating selection instead of stranding it', () => {
    useProjectStore.getState().moveSelection(2, 0)
    useProjectStore.getState().setActiveTool('pencil')

    const { project, selection } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(selection).toBeNull()
    expect(project.frames[0].layerPixels[layerId][2 * 8 + 4]).toBe('#ff0000')
  })

  it('pins the top-left corner when the bottom-right one is dragged', () => {
    const before = useProjectStore.getState().selectionOffset
    useProjectStore.getState().setSelectionScale(2, 2, 0, 0)

    const after = useProjectStore.getState()
    expect(after.selectionOffset).toEqual(before)
    expect(after.selection!.width).toBe(4)
  })

  it('pins the bottom-right corner when the top-left one is dragged', () => {
    const before = useProjectStore.getState()
    const rightEdge = before.selectionOffset.x + before.selection!.width
    const bottomEdge = before.selectionOffset.y + before.selection!.height

    useProjectStore.getState().setSelectionScale(2, 2, 1, 1)

    const after = useProjectStore.getState()
    expect(after.selectionOffset.x + after.selection!.width).toBe(rightEdge)
    expect(after.selectionOffset.y + after.selection!.height).toBe(bottomEdge)
  })

  it('stretches width and height independently', () => {
    useProjectStore.getState().setSelectionScale(3, 1, 0, 0)

    const { selection, selectionScaleX, selectionScaleY } = useProjectStore.getState()
    expect([selectionScaleX, selectionScaleY]).toEqual([3, 1])
    expect(selection!.width).toBe(6)
    expect(selection!.height).toBe(2)
  })

  it('does not let repeated rotation steps walk the selection off its pivot', () => {
    const before = useProjectStore.getState()
    const centerX = before.selectionOffset.x + before.selection!.width / 2
    const centerY = before.selectionOffset.y + before.selection!.height / 2

    // a drag fires one of these per pointermove; rounding each one used to
    // accumulate and visibly slide the shape away from its centre
    for (let i = 1; i <= 40; i++) {
      useProjectStore.getState().setSelectionRotation((i * Math.PI) / 40)
    }

    const after = useProjectStore.getState()
    expect(after.selectionOffset.x + after.selection!.width / 2).toBeCloseTo(centerX, 6)
    expect(after.selectionOffset.y + after.selection!.height / 2).toBeCloseTo(centerY, 6)
  })

  it('refineSelection re-rasterises at quality without moving the shape off centre', () => {
    useProjectStore.getState().setSelectionRotation(Math.PI / 5)
    const before = useProjectStore.getState()
    const centerX = before.selectionOffset.x + before.selection!.width / 2
    const centerY = before.selectionOffset.y + before.selection!.height / 2

    useProjectStore.getState().refineSelection()

    const after = useProjectStore.getState()
    expect(after.selection).not.toBeNull()
    expect(after.selectionOffset.x + after.selection!.width / 2).toBeCloseTo(centerX, 6)
    expect(after.selectionOffset.y + after.selection!.height / 2).toBeCloseTo(centerY, 6)
  })

  it('keeps the floating selection alive when switching to the move tool', () => {
    useProjectStore.getState().setActiveTool('move')

    const { selection, project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(selection).not.toBeNull()
    // still cut out of the layer — the move tool is expected to drag it, not paste it
    expect(project.frames[0].layerPixels[layerId][2 * 8 + 2]).toBeNull()
  })

  it('undo after committing a transform restores the pixels the cut removed', () => {
    useProjectStore.getState().moveSelection(2, 0)
    useProjectStore.getState().commitSelection()
    useProjectStore.getState().undo()

    const { project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    const pixels = project.frames[0].layerPixels[layerId]
    expect(pixels[2 * 8 + 2]).toBe('#ff0000')
    expect(pixels[2 * 8 + 4]).toBeNull()
  })
})

describe('copying and pasting frames', () => {
  const pixelsOf = (frameIndex: number, layerId: string) =>
    useProjectStore.getState().project.frames[frameIndex].layerPixels[layerId]

  beforeEach(() => {
    useProjectStore.getState().newProject('Frames', 4, 4)
    // frame 0 holds a red pixel at (1,1); frame 1 is empty
    useProjectStore.getState().paintAt(1, 1, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().addFrame()
    useProjectStore.getState().setActiveFrame(0)
  })

  it('pasting over replaces the selected frame with the copied one', () => {
    const layerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().copyFrame()
    useProjectStore.getState().setActiveFrame(1)
    useProjectStore.getState().pasteFrame()

    expect(pixelsOf(1, layerId)[1 * 4 + 1]).toBe('#ff0000')
    expect(useProjectStore.getState().project.frames).toHaveLength(2)
  })

  it('pasting as new inserts a frame after the selected one and selects it', () => {
    const layerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().copyFrame()
    useProjectStore.getState().pasteFrameAsNew() // active frame is 0, so the copy lands at 1

    const { project } = useProjectStore.getState()
    expect(project.frames).toHaveLength(3)
    expect(project.activeFrameIndex).toBe(1)
    expect(pixelsOf(1, layerId)[1 * 4 + 1]).toBe('#ff0000')
    // the frame that used to be second is pushed along, untouched
    expect(pixelsOf(2, layerId).every((p) => p === null)).toBe(true)
  })

  it('copies every layer of the frame, not just the active one', () => {
    useProjectStore.getState().addLayer() // Layer 2, active
    const upperLayer = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().paintAt(2, 2, '#00ff00')
    useProjectStore.getState().commitStroke('Pencil')
    const lowerLayer = useProjectStore.getState().project.layers[0].id

    useProjectStore.getState().copyFrame()
    useProjectStore.getState().setActiveFrame(1)
    useProjectStore.getState().pasteFrame()

    expect(pixelsOf(1, lowerLayer)[1 * 4 + 1]).toBe('#ff0000')
    expect(pixelsOf(1, upperLayer)[2 * 4 + 2]).toBe('#00ff00')
  })

  it('the copy is a snapshot: drawing on the source afterwards does not change it', () => {
    const layerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().copyFrame()
    useProjectStore.getState().paintAt(3, 3, '#0000ff') // edit the source after copying
    useProjectStore.getState().commitStroke('Pencil')

    useProjectStore.getState().setActiveFrame(1)
    useProjectStore.getState().pasteFrame()

    expect(pixelsOf(1, layerId)[3 * 4 + 3]).toBeNull()
  })

  it('pasted pixels are independent of the clipboard, so one copy can be pasted twice', () => {
    const layerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().copyFrame()
    useProjectStore.getState().setActiveFrame(1)
    useProjectStore.getState().pasteFrame()
    useProjectStore.getState().paintAt(0, 0, '#ffffff') // scribble on the pasted frame
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().pasteFrame() // paste the original copy again

    expect(pixelsOf(1, layerId)[0]).toBeNull()
    expect(pixelsOf(1, layerId)[1 * 4 + 1]).toBe('#ff0000')
  })

  it('a layer added after the copy comes out empty rather than keeping old pixels', () => {
    useProjectStore.getState().copyFrame()
    useProjectStore.getState().addLayer()
    const newLayer = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().setActiveFrame(1)
    useProjectStore.getState().paintAt(0, 0, '#ffffff')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().pasteFrame()

    expect(pixelsOf(1, newLayer).every((p) => p === null)).toBe(true)
  })

  it('pasting can be undone', () => {
    const layerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().copyFrame()
    useProjectStore.getState().setActiveFrame(1)
    useProjectStore.getState().pasteFrame()
    expect(useProjectStore.getState().historyLabels.at(-1)).toBe('Paste frame')

    useProjectStore.getState().undo()

    expect(pixelsOf(1, layerId).every((p) => p === null)).toBe(true)
  })

  it('pasting as new can be undone', () => {
    useProjectStore.getState().copyFrame()
    useProjectStore.getState().pasteFrameAsNew()
    expect(useProjectStore.getState().project.frames).toHaveLength(3)

    useProjectStore.getState().undo()

    expect(useProjectStore.getState().project.frames).toHaveLength(2)
  })

  it('does nothing when there is nothing copied', () => {
    const before = useProjectStore.getState().project
    useProjectStore.getState().pasteFrame()
    useProjectStore.getState().pasteFrameAsNew()
    expect(useProjectStore.getState().project).toBe(before)
  })

  it('starting or loading another project drops the clipboard, whose layer ids no longer apply', () => {
    useProjectStore.getState().copyFrame()
    expect(useProjectStore.getState().frameClipboard).not.toBeNull()
    useProjectStore.getState().newProject('Other', 4, 4)
    expect(useProjectStore.getState().frameClipboard).toBeNull()
  })

  it('copying while a lasso selection is floating includes the selected pixels', () => {
    const layerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().startLassoSelection([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
    ])
    expect(pixelsOf(0, layerId)[1 * 4 + 1]).toBeNull() // cut out of the layer, floating

    useProjectStore.getState().copyFrame()

    expect(useProjectStore.getState().frameClipboard![layerId][1 * 4 + 1]).toBe('#ff0000')
  })
})

describe('reorderLayer', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Layers', 4, 4)
    useProjectStore.getState().addLayer()
  })

  it('moves a layer towards the top of the stack', () => {
    useProjectStore.getState().reorderLayer(1, 0)
    expect(useProjectStore.getState().project.layers.map((l) => l.name)).toEqual(['Layer 2', 'Layer 1'])
  })

  it('ignores a move that would fall off either end', () => {
    const before = useProjectStore.getState().project.layers.map((l) => l.name)
    useProjectStore.getState().reorderLayer(0, -1)
    useProjectStore.getState().reorderLayer(1, 2)
    expect(useProjectStore.getState().project.layers.map((l) => l.name)).toEqual(before)
  })
})

describe('onion skin', () => {
  it('toggles on and back off', () => {
    const initial = useProjectStore.getState().onionSkin
    useProjectStore.getState().toggleOnionSkin()
    expect(useProjectStore.getState().onionSkin).toBe(!initial)
    useProjectStore.getState().toggleOnionSkin()
    expect(useProjectStore.getState().onionSkin).toBe(initial)
  })
})

describe('palette editing', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Palette', 4, 4)
  })

  it('removePaletteColor drops just that colour', () => {
    useProjectStore.getState().addPaletteColor('#111111')
    useProjectStore.getState().addPaletteColor('#222222')
    useProjectStore.getState().removePaletteColor('#111111')
    expect(useProjectStore.getState().project.palette).toEqual(['#222222'])
  })

  it('setPalette replaces the whole palette', () => {
    useProjectStore.getState().addPaletteColor('#111111')
    useProjectStore.getState().setPalette(['#aaaaaa', '#bbbbbb'])
    expect(useProjectStore.getState().project.palette).toEqual(['#aaaaaa', '#bbbbbb'])
  })

  it('undo brings back a colour that was removed', () => {
    useProjectStore.getState().addPaletteColor('#111111')
    useProjectStore.getState().addPaletteColor('#222222')
    useProjectStore.getState().removePaletteColor('#111111')
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().project.palette).toEqual(['#111111', '#222222'])
  })

  it('undo brings back a palette that was replaced or cleared, and the history entry carries the label', () => {
    useProjectStore.getState().addPaletteColor('#111111')
    useProjectStore.getState().setPalette([], 'Clear palette')
    expect(useProjectStore.getState().historyLabels).toEqual(['Clear palette'])
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().project.palette).toEqual(['#111111'])
  })

  it('adding a colour does not use a history slot', () => {
    useProjectStore.getState().addPaletteColor('#111111')
    expect(useProjectStore.getState().history).toHaveLength(0)
  })

  it('a change that leaves the palette as it was is not recorded', () => {
    useProjectStore.getState().addPaletteColor('#111111')
    useProjectStore.getState().setPalette(['#111111'])
    useProjectStore.getState().removePaletteColor('#999999')
    expect(useProjectStore.getState().history).toHaveLength(0)
  })

  it('a palette edit clears redo and marks the project dirty', () => {
    useProjectStore.getState().paintAt(0, 0, '#111111')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().future).toHaveLength(1)
    useProjectStore.getState().addPaletteColor('#111111')
    useProjectStore.getState().removePaletteColor('#111111')
    expect(useProjectStore.getState().future).toEqual([])
    expect(useProjectStore.getState().isDirty).toBe(true)
  })
})

describe('addPaletteColor', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Palette', 4, 4)
  })

  it('appends a new color to the palette', () => {
    useProjectStore.getState().addPaletteColor('#ff00ff')
    expect(useProjectStore.getState().project.palette).toContain('#ff00ff')
  })

  it('does not add duplicate colors', () => {
    useProjectStore.getState().addPaletteColor('#ff00ff')
    useProjectStore.getState().addPaletteColor('#ff00ff')
    expect(useProjectStore.getState().project.palette).toEqual(['#ff00ff'])
  })
})

describe('renameProject', () => {
  it('updates project.name', () => {
    useProjectStore.getState().newProject('Old', 4, 4)
    useProjectStore.getState().renameProject('New')
    expect(useProjectStore.getState().project.name).toBe('New')
  })
})
