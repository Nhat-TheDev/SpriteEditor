import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Canvas } from './Canvas'
import { useProjectStore } from '../../lib/store/projectStore'

describe('Canvas', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 4, 4)
  })

  it('renders a canvas sized to the project pixel dimensions', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    expect(canvas.width).toBe(4)
    expect(canvas.height).toBe(4)
  })
})

describe('Canvas auto-fit zoom', () => {
  function renderInViewport(width: number, height: number) {
    const viewport = document.createElement('div')
    Object.defineProperty(viewport, 'clientWidth', { value: width, configurable: true })
    Object.defineProperty(viewport, 'clientHeight', { value: height, configurable: true })
    document.body.appendChild(viewport)
    return render(<Canvas />, { container: viewport })
  }

  it('shrinks the initial zoom to fit a viewport smaller than the canvas at the default zoom', () => {
    useProjectStore.getState().newProject('Big', 64, 64)
    // default zoom (8) * 64 = 512px, well past this 300x300 viewport
    renderInViewport(300, 300)
    // (300 - 32px padding) / 64 = 4.19 -> floor to 4
    expect(useProjectStore.getState().zoom).toBe(4)
  })

  it('keeps the default zoom when the viewport comfortably fits the canvas', () => {
    useProjectStore.getState().newProject('Small', 16, 16)
    renderInViewport(600, 600)
    // (600 - 32) / 16 = 35.5 -> clamped to the 64 max, but default zoom (8) already fits
    expect(useProjectStore.getState().zoom).toBeGreaterThanOrEqual(8)
  })

  it('never picks a zoom below 1 even for a canvas much larger than the viewport', () => {
    useProjectStore.getState().newProject('Huge', 256, 256)
    renderInViewport(200, 200)
    expect(useProjectStore.getState().zoom).toBeGreaterThanOrEqual(1)
  })

  it('re-fits when a newly created project has the same dimensions as the previous one', () => {
    useProjectStore.getState().newProject('First', 32, 32)
    renderInViewport(200, 200)
    // (200 - 32) / 32 = 5.25 -> floor to 5
    expect(useProjectStore.getState().zoom).toBe(5)

    // newProject() resets zoom to its own hardcoded default (8) synchronously;
    // since the dimensions are unchanged (32x32 -> 32x32), only projectRevision
    // signals that a re-fit is needed
    act(() => {
      useProjectStore.getState().newProject('Second', 32, 32)
    })
    expect(useProjectStore.getState().zoom).toBe(5)
  })
})

import { fireEvent } from '@testing-library/react'

describe('Canvas pencil/eraser interaction', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 4, 4)
    useProjectStore.getState().setZoom(10)
  })

  it('paints a pixel on pointer down and commits history on pointer up', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      right: 40,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5 })

    const { project, history, historyLabels } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][0]).toBe('#808080')
    expect(history).toHaveLength(1)
    expect(historyLabels).toEqual(['Pencil'])
  })

  it('erases (sets null) when activeTool is eraser', () => {
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().setActiveTool('eraser')

    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      right: 40,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5 })

    const { project } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][0]).toBeNull()
  })
})

describe('Canvas panning', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 4, 4)
    useProjectStore.getState().setZoom(10)
  })

  it('pans on middle-click drag', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      right: 40,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, button: 1 })
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 5, buttons: 4 })
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 5 })

    const { panX, panY } = useProjectStore.getState()
    expect(panX).toBe(1) // 10px screen / zoom 10 = 1 pixel
    expect(panY).toBeCloseTo(0.5)
  })
})

describe('Canvas line tool', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 4, 4)
    useProjectStore.getState().setZoom(10)
    useProjectStore.getState().setActiveTool('line')
  })

  it('commits a straight line from drag start to drag end on pointer up', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      right: 40,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 30, clientY: 0, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 0 })

    const { project, historyLabels } = useProjectStore.getState()
    const layerId = project.activeLayerId
    const pixels = project.frames[0].layerPixels[layerId]
    expect(pixels[0]).toBe('#808080')
    expect(pixels[1]).toBe('#808080')
    expect(pixels[2]).toBe('#808080')
    expect(pixels[3]).toBe('#808080')
    expect(historyLabels).toEqual(['Line'])
  })

  it('does not commit intermediate drag positions to history', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      right: 40,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 0, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 0, buttons: 1 })
    expect(useProjectStore.getState().history).toHaveLength(0)
  })
})

describe('Canvas rectangle tool', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 2, 2)
    useProjectStore.getState().setZoom(10)
    useProjectStore.getState().setActiveTool('rectangle')
    useProjectStore.getState().setShapeFilled(true)
  })

  it('commits a filled rectangle from drag start to drag end', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 40, height: 40, right: 40, bottom: 40, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 15, clientY: 15, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 15, clientY: 15 })

    const { project, historyLabels } = useProjectStore.getState()
    const layerId = project.activeLayerId
    const pixels = project.frames[0].layerPixels[layerId]
    // rectangle from (0,0) to (1,1) filled -> all 4 pixels set
    expect(pixels).toEqual(['#808080', '#808080', '#808080', '#808080'])
    expect(historyLabels).toEqual(['Rectangle'])
  })
})

describe('Canvas ellipse tool', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 9, 9)
    useProjectStore.getState().setZoom(10)
    useProjectStore.getState().setActiveTool('ellipse')
    useProjectStore.getState().setShapeFilled(false)
  })

  it('commits an ellipse outline centered between drag start and end', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 90, height: 90, right: 90, bottom: 90, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 80, clientY: 80, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 80, clientY: 80 })

    const { project, historyLabels } = useProjectStore.getState()
    expect(historyLabels).toEqual(['Ellipse'])
    const layerId = project.activeLayerId
    const pixels = project.frames[0].layerPixels[layerId]
    expect(pixels.some((p) => p !== null)).toBe(true)
  })
})

describe('Canvas fill tool', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 3, 3)
    useProjectStore.getState().setZoom(10)
    useProjectStore.getState().setActiveTool('fill')
  })

  it('fills the clicked region on pointer up and commits history', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 30, height: 30, right: 30, bottom: 30, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5 })

    const { project, historyLabels } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId].every((p) => p === '#808080')).toBe(true)
    expect(historyLabels).toEqual(['Fill'])
  })
})

describe('Canvas eyedropper tool', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 4, 4)
    useProjectStore.getState().setZoom(10)
    useProjectStore.getState().paintAt(0, 0, '#abcdef')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().setActiveTool('eyedropper')
  })

  it('sets activeColor to the clicked pixel color without touching history', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 40, height: 40, right: 40, bottom: 40, x: 0, y: 0, toJSON: () => {},
    })
    const historyBefore = useProjectStore.getState().history.length
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, buttons: 1 })

    expect(useProjectStore.getState().activeColor).toBe('#abcdef')
    expect(useProjectStore.getState().history.length).toBe(historyBefore)
  })
})

describe('Canvas move tool', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 4, 4)
    useProjectStore.getState().setZoom(10)
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().setActiveTool('move')
  })

  it('moves the layer content by the drag delta and commits history on release', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 40, height: 40, right: 40, bottom: 40, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 0, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 0 })

    const { project, historyLabels } = useProjectStore.getState()
    const layerId = project.activeLayerId
    const pixels = project.frames[0].layerPixels[layerId]
    expect(pixels[1]).toBe('#ff0000')
    expect(historyLabels).toEqual(['Pencil', 'Move'])
  })
})

describe('Canvas lasso tool', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 8, 8)
    useProjectStore.getState().setZoom(10)
    useProjectStore.getState().paintAt(2, 2, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().setActiveTool('lasso')
  })

  it('shows a live preview polyline while the freehand path is being dragged', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 80, right: 80, bottom: 80, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 10, buttons: 1 })

    expect(document.querySelector('polyline')).toBeTruthy()
    expect(document.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2)
  })

  it('press-drag-release traces a freehand path and auto-closes the selection on release', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 80, right: 80, bottom: 80, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 10, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 40, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 40, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 40 })

    expect(useProjectStore.getState().selection).not.toBeNull()
    // the path we dragged encloses the pixel painted in beforeEach
    const layerId = useProjectStore.getState().project.activeLayerId
    expect(useProjectStore.getState().project.frames[0].layerPixels[layerId][2 * 8 + 2]).toBeNull()
  })

  it('does not start a selection when released without dragging (path too short)', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 80, right: 80, bottom: 80, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10 })

    expect(useProjectStore.getState().selection).toBeNull()
  })

  it('clears the preview polyline when the path was too short to close', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 80, right: 80, bottom: 80, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 10, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 10 })

    expect(document.querySelector('polyline')).toBeNull()
  })

  it('keeps a floating selection visible on the canvas instead of leaving a hole', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    act(() => {
      useProjectStore.getState().startLassoSelection([
        { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 },
      ])
    })

    const ctx = canvas.getContext('2d')!
    expect(ctx.getImageData(2, 2, 1, 1).data[3]).toBeGreaterThan(0)
  })

  it('redraws the floating selection at its new offset while it is being moved', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    act(() => {
      useProjectStore.getState().startLassoSelection([
        { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 },
      ])
    })
    act(() => {
      useProjectStore.getState().moveSelection(3, 0)
    })

    const ctx = canvas.getContext('2d')!
    expect(ctx.getImageData(2, 2, 1, 1).data[3]).toBe(0)
    expect(ctx.getImageData(5, 2, 1, 1).data[3]).toBeGreaterThan(0)
  })

  it('drags the floating selection with the move tool instead of the layer underneath', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 80, right: 80, bottom: 80, x: 0, y: 0, toJSON: () => {},
    })
    act(() => {
      useProjectStore.getState().startLassoSelection([
        { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 },
      ])
    })
    act(() => {
      useProjectStore.getState().setActiveTool('move')
    })
    const offsetBefore = useProjectStore.getState().selectionOffset

    fireEvent.pointerDown(canvas, { clientX: 25, clientY: 25, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 55, clientY: 25, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 55, clientY: 25 })

    const { selectionOffset, selection, historyLabels } = useProjectStore.getState()
    expect(selection).not.toBeNull()
    expect(selectionOffset.x).toBe(offsetBefore.x + 3)
    expect(selectionOffset.y).toBe(offsetBefore.y)
    // the layer itself must not have been dragged
    expect(historyLabels).not.toContain('Move')
  })

  it('shows a move cursor on the canvas while a selection is floating', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    expect(canvas.style.cursor).toBe('')
    act(() => {
      useProjectStore.getState().startLassoSelection([
        { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 },
      ])
    })
    expect(canvas.style.cursor).toBe('move')
  })

  it('shows an onion-skin layer only when it is on and there is a previous frame', () => {
    render(<Canvas />)
    expect(screen.queryByTestId('onion-skin-canvas')).toBeNull()

    act(() => {
      useProjectStore.getState().toggleOnionSkin()
    })
    // still frame 0 — there is nothing behind it to show
    expect(screen.queryByTestId('onion-skin-canvas')).toBeNull()

    act(() => {
      useProjectStore.getState().addFrame()
    })
    expect(useProjectStore.getState().project.activeFrameIndex).toBeGreaterThan(0)
    expect(screen.getByTestId('onion-skin-canvas')).toBeInTheDocument()

    act(() => {
      useProjectStore.getState().toggleOnionSkin()
    })
    expect(screen.queryByTestId('onion-skin-canvas')).toBeNull()
  })

  it('rotates the selection box itself instead of growing an upright bounding box', () => {
    render(<Canvas />)
    act(() => {
      useProjectStore.getState().startLassoSelection([
        { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 5 },
      ])
    })
    const box = screen.getByTestId('selection-box')
    const uprightWidth = box.style.width
    expect(box.style.transform).toBe('rotate(0rad)')

    act(() => {
      useProjectStore.getState().setSelectionRotation(Math.PI / 4)
    })

    const rotated = screen.getByTestId('selection-box')
    expect(rotated.style.transform).toBe(`rotate(${Math.PI / 4}rad)`)
    // the frame turns; it must not swell into the rasterised bounding box
    expect(rotated.style.width).toBe(uprightWidth)
  })

  it('sizes the selection box from the two axis scales independently', () => {
    render(<Canvas />)
    act(() => {
      useProjectStore.getState().startLassoSelection([
        { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 5 },
      ])
    })
    act(() => {
      useProjectStore.getState().setSelectionScale(3, 1, 0, 0)
    })

    const box = screen.getByTestId('selection-box')
    const zoom = useProjectStore.getState().zoom
    const base = useProjectStore.getState().originalSelectionBuffer!
    expect(box.style.width).toBe(`${base.width * 3 * zoom}px`)
    expect(box.style.height).toBe(`${base.height * 1 * zoom}px`)
  })

  it('refines the selection once a transform handle is released', () => {
    const original = useProjectStore.getState().refineSelection
    const refine = vi.fn()
    try {
      render(<Canvas />)
      act(() => {
        useProjectStore.getState().startLassoSelection([
          { x: 2, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 5 }, { x: 2, y: 5 },
        ])
      })
      act(() => {
        useProjectStore.setState({ refineSelection: refine })
      })

      const handle = screen.getByTestId('selection-handle-rotate')
      fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 })
      fireEvent.pointerUp(window)

      expect(refine).toHaveBeenCalled()
    } finally {
      useProjectStore.setState({ refineSelection: original })
    }
  })

  it('lets a press inside the selection box reach the canvas so it can be dragged', () => {
    render(<Canvas />)
    act(() => {
      useProjectStore.getState().startLassoSelection([
        { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 },
      ])
    })

    const box = document.querySelector('.border-accent') as HTMLElement
    expect(box.className).toContain('pointer-events-none')
  })
})

describe('Canvas overlay stacking', () => {
  // The sprite canvas is z-10, so an overlay with no z-index of its own is
  // painted underneath it and vanishes wherever a pixel is opaque. jsdom does no
  // layout, so the order is asserted from the z-* classes themselves.
  function zOf(el: Element) {
    const match = (el.getAttribute('class') ?? '').match(/(?:^|\s)z-(\d+)(?:\s|$)/)
    expect(match, `${el.getAttribute('data-testid')} needs a z-* class`).not.toBeNull()
    return Number(match![1])
  }

  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 8, 8)
    useProjectStore.getState().setZoom(10)
    useProjectStore.getState().setActiveTool('lasso')
  })

  it('layers onion skin < canvas < symmetry guides < lasso preview < selection box', () => {
    render(<Canvas />)
    const canvas = screen.getByTestId('sprite-canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 80, height: 80, right: 80, bottom: 80, x: 0, y: 0, toJSON: () => {},
    })
    act(() => {
      useProjectStore.getState().setSymmetryMode('xy')
      useProjectStore.getState().toggleOnionSkin()
      useProjectStore.getState().addFrame()
    })
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, buttons: 1 })
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 10, buttons: 1 })

    const onion = zOf(screen.getByTestId('onion-skin-canvas'))
    const sprite = zOf(canvas)
    const guides = zOf(screen.getByTestId('symmetry-guides'))
    const lasso = zOf(screen.getByTestId('lasso-preview'))

    // the path is finished before a selection can exist, so the selection box
    // is measured after the lasso preview has been dropped
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 40, buttons: 1 })
    fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40 })
    const selectionBox = zOf(screen.getByTestId('selection-box'))

    expect(onion).toBeLessThan(sprite)
    expect(sprite).toBeLessThan(guides)
    expect(guides).toBeLessThan(lasso)
    expect(lasso).toBeLessThan(selectionBox)
  })
})
