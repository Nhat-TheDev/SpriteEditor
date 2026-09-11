'use client'

import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../../lib/store/projectStore'
import { compositeFrame, pixelsToImageData } from '../../lib/canvas/compositing'
import { pasteSelection } from '../../lib/canvas/transform'
import { screenToPixel, clampZoom } from '../../lib/canvas/zoomPan'
import { bresenhamLine, rectanglePoints, midpointEllipsePoints } from '../../lib/canvas/drawing'

const TOOL_LABELS: Record<string, string> = {
  pencil: 'Pencil',
  eraser: 'Eraser',
}

const VIEWPORT_PADDING = 32

// Below this the rasterised buffer collapses to nothing and the drag can never
// be undone by dragging back out, so corner resizing stops here.
const MIN_SELECTION_SCALE = 0.05

// Integer scales and quarter turns are the only transforms that survive
// rasterising untouched, so make them easy to land on instead of something you
// can only hit by accident.
const SCALE_SNAP_TOLERANCE = 0.06
const ROTATION_SNAP_STEP = Math.PI / 12 // 15 degrees, with Shift held

function snapScale(value: number) {
  const nearest = Math.round(value)
  return nearest >= 1 && Math.abs(value - nearest) < SCALE_SNAP_TOLERANCE ? nearest : value
}

function rotatePoint(x: number, y: number, radians: number) {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onionCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isPaintingRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 })
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const SHAPE_TOOLS = new Set(['line', 'rectangle', 'ellipse'])
  const project = useProjectStore((s) => s.project)
  const projectRevision = useProjectStore((s) => s.projectRevision)
  const zoom = useProjectStore((s) => s.zoom)
  const panX = useProjectStore((s) => s.panX)
  const panY = useProjectStore((s) => s.panY)
  const activeTool = useProjectStore((s) => s.activeTool)
  const activeColor = useProjectStore((s) => s.activeColor)
  const paintAt = useProjectStore((s) => s.paintAt)
  const commitStroke = useProjectStore((s) => s.commitStroke)
  const setZoom = useProjectStore((s) => s.setZoom)
  const setPan = useProjectStore((s) => s.setPan)
  const shapeFilled = useProjectStore((s) => s.shapeFilled)
  const applyFloodFill = useProjectStore((s) => s.applyFloodFill)
  const setActiveColor = useProjectStore((s) => s.setActiveColor)
  const moveLayerContent = useProjectStore((s) => s.moveLayerContent)
  const onionSkin = useProjectStore((s) => s.onionSkin)
  const moveAccumRef = useRef({ x: 0, y: 0 })
  const selection = useProjectStore((s) => s.selection)
  const selectionOffset = useProjectStore((s) => s.selectionOffset)
  const selectionScaleX = useProjectStore((s) => s.selectionScaleX)
  const selectionScaleY = useProjectStore((s) => s.selectionScaleY)
  const originalSelectionBuffer = useProjectStore((s) => s.originalSelectionBuffer)
  const selectionRotation = useProjectStore((s) => s.selectionRotation)
  const startLassoSelection = useProjectStore((s) => s.startLassoSelection)
  const moveSelection = useProjectStore((s) => s.moveSelection)
  const setSelectionScale = useProjectStore((s) => s.setSelectionScale)
  const setSelectionRotation = useProjectStore((s) => s.setSelectionRotation)
  const refineSelection = useProjectStore((s) => s.refineSelection)
  const commitSelection = useProjectStore((s) => s.commitSelection)
  const cancelSelection = useProjectStore((s) => s.cancelSelection)
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([])

  // While a selection is floating, both lasso and move drag it. Move is the
  // tool a user reaches for to reposition something, so it has to keep working
  // on the selection rather than on the layer underneath it.
  const draggingSelection = selection !== null && (activeTool === 'lasso' || activeTool === 'move')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const frame = project.frames[project.activeFrameIndex]
    const pixels = compositeFrame(frame, project.layers, project.width, project.height)
    // A floating selection has already been cut out of its layer, so it is not
    // part of the composite; draw it on top at its current offset, otherwise
    // the selected pixels look erased until the transform is committed.
    const withSelection = selection
      ? pasteSelection(
          pixels,
          project.width,
          project.height,
          selection,
          Math.round(selectionOffset.x),
          Math.round(selectionOffset.y)
        )
      : pixels
    const imageData = pixelsToImageData(withSelection, project.width, project.height)
    ctx.imageSmoothingEnabled = false
    ctx.putImageData(imageData, 0, 0)
  }, [project, selection, selectionOffset])

  // Auto-fit zoom so a newly created/loaded project's canvas always starts
  // fully visible instead of overflowing the viewport at the fixed default
  // zoom (a 64x64+ canvas at zoom 8 = 512px+, which clips off the bottom/
  // right edges on smaller windows with no obvious scrollbar cue — looking
  // like missing content rather than an overflow).
  //
  // Keyed on projectRevision rather than project.width/height: those don't
  // change when a newly created project happens to have the same
  // dimensions as the one before it (e.g. the default 32x32 recreated via
  // New Project), which would otherwise skip re-fitting entirely.
  useEffect(() => {
    const viewport = containerRef.current?.parentElement
    if (!viewport) return
    const availableWidth = viewport.clientWidth - VIEWPORT_PADDING
    const availableHeight = viewport.clientHeight - VIEWPORT_PADDING
    if (availableWidth <= 0 || availableHeight <= 0) return
    const fitZoom = clampZoom(
      Math.floor(Math.min(availableWidth / project.width, availableHeight / project.height))
    )
    setZoom(fitZoom)
    setPan(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectRevision])

  // Onion skin lives on its own canvas underneath the real one rather than
  // being blended into the same ImageData: putImageData replaces rather than
  // composites, so sharing one canvas would mean hand-writing RGB blending for
  // every pixel. A second canvas at low opacity is the same result for free.
  useEffect(() => {
    const canvas = onionCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, project.width, project.height)
    const previous = project.frames[project.activeFrameIndex - 1]
    if (!previous) return
    const pixels = compositeFrame(previous, project.layers, project.width, project.height)
    ctx.imageSmoothingEnabled = false
    ctx.putImageData(pixelsToImageData(pixels, project.width, project.height), 0, 0)
  }, [project, onionSkin])

  function pointToPixel(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { x, y } = screenToPixel(clientX, clientY, rect, zoom, -panX, -panY)
    if (x < 0 || x >= project.width || y < 0 || y >= project.height) return null
    return { x, y }
  }

  function pointToProjectedPixel(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { x, y } = screenToPixel(clientX, clientY, rect, zoom, -panX, -panY)
    return { x, y }
  }

  // Dragging a lasso path or a selection routinely runs past the canvas edge.
  // Returning null there (as pointToPixel does, correctly, for painting) would
  // silently drop those samples, breaking the path or freezing the drag, so
  // clamp to the nearest edge pixel instead.
  function pointToPixelClamped(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { x, y } = screenToPixel(clientX, clientY, rect, zoom, -panX, -panY)
    return {
      x: Math.min(project.width - 1, Math.max(0, x)),
      y: Math.min(project.height - 1, Math.max(0, y)),
    }
  }

  function paintPixelForActiveTool(x: number, y: number) {
    if (activeTool === 'pencil') paintAt(x, y, activeColor)
    else if (activeTool === 'eraser') paintAt(x, y, null)
  }

  function closeLasso(points: { x: number; y: number }[]) {
    // Clear first: a path too short to close still has to drop its preview,
    // otherwise the dashed polyline and its dots stay stuck on the canvas.
    setLassoPoints([])
    if (points.length < 3) return
    startLassoSelection(points)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Capture, so pointermove/pointerup keep arriving once the drag leaves the
    // canvas. Without it the canvas had to treat pointerleave as a release,
    // which cut lasso paths short the moment the cursor crossed the edge.
    // (jsdom has no pointer capture; the guard keeps tests running.)
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (e.button === 1) {
      isPanningRef.current = true
      panStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX, panY }
      return
    }
    if (draggingSelection) {
      const p = pointToPixelClamped(e.clientX, e.clientY)
      if (!p) return
      shapeStartRef.current = p
      moveAccumRef.current = { x: 0, y: 0 }
      isPaintingRef.current = true
      return
    }
    if (activeTool === 'lasso') {
      const p = pointToPixelClamped(e.clientX, e.clientY)
      if (!p) return
      // freehand: press down to start a new path, drag to trace it (handled
      // in handlePointerMove), release to auto-close it (handlePointerUp)
      setLassoPoints([p])
      isPaintingRef.current = true
      return
    }
    if (activeTool === 'move') {
      const p = pointToPixel(e.clientX, e.clientY)
      if (!p) return
      shapeStartRef.current = p
      moveAccumRef.current = { x: 0, y: 0 }
      isPaintingRef.current = true
      return
    }
    if (SHAPE_TOOLS.has(activeTool)) {
      const p = pointToPixel(e.clientX, e.clientY)
      if (!p) return
      shapeStartRef.current = p
      isPaintingRef.current = true
      return
    }
    if (activeTool === 'eyedropper') {
      const p = pointToPixel(e.clientX, e.clientY)
      if (!p) return
      const frame = project.frames[project.activeFrameIndex]
      const pixels = compositeFrame(frame, project.layers, project.width, project.height)
      const color = pixels[p.y * project.width + p.x]
      if (color) setActiveColor(color)
      return
    }
    if (activeTool === 'fill') {
      const p = pointToPixel(e.clientX, e.clientY)
      if (!p) return
      applyFloodFill(p.x, p.y, activeColor)
      commitStroke('Fill')
      return
    }
    if (activeTool !== 'pencil' && activeTool !== 'eraser') return
    const p = pointToPixel(e.clientX, e.clientY)
    if (!p) return
    isPaintingRef.current = true
    paintPixelForActiveTool(p.x, p.y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (isPanningRef.current) {
      const start = panStartRef.current
      const dx = (e.clientX - start.clientX) / zoom
      const dy = (e.clientY - start.clientY) / zoom
      setPan(start.panX + dx, start.panY + dy)
      return
    }
    if (activeTool === 'lasso' && !selection && isPaintingRef.current) {
      const p = pointToPixelClamped(e.clientX, e.clientY)
      if (!p) return
      setLassoPoints((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.x === p.x && last.y === p.y) return prev
        return [...prev, p]
      })
      return
    }
    if (draggingSelection && isPaintingRef.current) {
      const start = shapeStartRef.current
      const current = pointToProjectedPixel(e.clientX, e.clientY)
      if (!start || !current) return
      const dx = current.x - start.x - moveAccumRef.current.x
      const dy = current.y - start.y - moveAccumRef.current.y
      if (dx !== 0 || dy !== 0) {
        moveSelection(dx, dy)
        moveAccumRef.current = { x: moveAccumRef.current.x + dx, y: moveAccumRef.current.y + dy }
      }
      return
    }
    if (activeTool === 'move' && isPaintingRef.current) {
      const start = shapeStartRef.current
      const current = pointToPixel(e.clientX, e.clientY)
      if (!start || !current) return
      const dx = current.x - start.x - moveAccumRef.current.x
      const dy = current.y - start.y - moveAccumRef.current.y
      if (dx !== 0 || dy !== 0) {
        moveLayerContent(dx, dy)
        moveAccumRef.current = { x: moveAccumRef.current.x + dx, y: moveAccumRef.current.y + dy }
      }
      return
    }
    if (SHAPE_TOOLS.has(activeTool) && isPaintingRef.current) {
      // preview is intentionally a no-op on the committed pixel grid;
      // the final shape is applied only on pointer up (kept simple: no
      // separate preview canvas layer, matching "less code is better code").
      return
    }
    if (!isPaintingRef.current) return
    const p = pointToPixel(e.clientX, e.clientY)
    if (!p) return
    paintPixelForActiveTool(p.x, p.y)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (isPanningRef.current) {
      isPanningRef.current = false
      return
    }
    if (activeTool === 'lasso' && !selection && isPaintingRef.current) {
      isPaintingRef.current = false
      closeLasso(lassoPoints)
      return
    }
    if (draggingSelection && isPaintingRef.current) {
      isPaintingRef.current = false
      shapeStartRef.current = null
      return
    }
    if (activeTool === 'move' && isPaintingRef.current) {
      isPaintingRef.current = false
      shapeStartRef.current = null
      commitStroke('Move')
      return
    }
    if (SHAPE_TOOLS.has(activeTool) && isPaintingRef.current) {
      isPaintingRef.current = false
      const start = shapeStartRef.current
      const end = pointToPixel(e.clientX, e.clientY)
      shapeStartRef.current = null
      if (!start || !end) return
      if (activeTool === 'line') {
        for (const p of bresenhamLine(start.x, start.y, end.x, end.y)) {
          paintAt(p.x, p.y, activeColor)
        }
        commitStroke('Line')
      } else if (activeTool === 'rectangle') {
        for (const p of rectanglePoints(start.x, start.y, end.x, end.y, shapeFilled)) {
          paintAt(p.x, p.y, activeColor)
        }
        commitStroke('Rectangle')
      } else if (activeTool === 'ellipse') {
        const cx = Math.round((start.x + end.x) / 2)
        const cy = Math.round((start.y + end.y) / 2)
        const rx = Math.max(1, Math.round(Math.abs(end.x - start.x) / 2))
        const ry = Math.max(1, Math.round(Math.abs(end.y - start.y) / 2))
        for (const p of midpointEllipsePoints(cx, cy, rx, ry, shapeFilled)) {
          paintAt(p.x, p.y, activeColor)
        }
        commitStroke('Ellipse')
      }
      return
    }
    if (!isPaintingRef.current) return
    isPaintingRef.current = false
    commitStroke(TOOL_LABELS[activeTool] ?? activeTool)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (activeTool !== 'lasso') return
      if (e.key === 'Enter') {
        if (selection) {
          commitSelection()
        } else {
          closeLasso(lassoPoints)
        }
      } else if (e.key === 'Escape') {
        if (selection) cancelSelection()
        setLassoPoints([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTool, selection, lassoPoints, commitSelection, startLassoSelection, cancelSelection])

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    if (!e.ctrlKey) return
    e.preventDefault()
    const direction = e.deltaY > 0 ? -1 : 1
    setZoom(clampZoom(zoom + direction))
  }

  // Stacking, bottom to top: onion skin z-0, sprite canvas z-10, symmetry
  // guides z-20, lasso preview z-30, selection box and its handles z-40. Every
  // overlay needs its own z-index: the canvas is z-10, so a positioned sibling
  // left at z-auto is painted underneath it and disappears behind any opaque pixel.
  return (
    <div
      ref={containerRef}
      className="checkerboard relative"
      style={{
        width: project.width * zoom,
        height: project.height * zoom,
        // Drawn as an outline, not a border: Tailwind's preflight sets
        // box-sizing: border-box globally, so a 2px border would shrink this
        // element's content box to (width*zoom - 4)px. The background
        // positioning area follows the padding box, so the checkerboard would
        // then tile across 252px instead of 256px at 32px/zoom 8 — leaving a
        // clipped three-quarter square in each far corner — while the canvas
        // child stayed at its full width*zoom and overflowed by those 4px.
        // An outline is painted outside the box and takes no layout space, so
        // the background area, the canvas, and the pixel grid all stay exactly
        // width*zoom.
        outline: '2px solid #000',
        // the checker itself comes from .checkerboard; the size is per zoom
        backgroundSize: `${zoom * 2}px ${zoom * 2}px`,
      }}
    >
      {onionSkin && project.activeFrameIndex > 0 && (
        <canvas
          ref={onionCanvasRef}
          data-testid="onion-skin-canvas"
          width={project.width}
          height={project.height}
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            width: project.width * zoom,
            height: project.height * zoom,
            imageRendering: 'pixelated',
            display: 'block',
            opacity: 0.35,
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        data-testid="sprite-canvas"
        className="relative z-10"
        width={project.width}
        height={project.height}
        style={{
          width: project.width * zoom,
          height: project.height * zoom,
          imageRendering: 'pixelated',
          // block, so the inline baseline gap doesn't add phantom space below
          display: 'block',
          // The selection box is pointer-events-none so presses reach the
          // canvas, which also means it cannot carry a cursor of its own —
          // without this nothing tells the user the selection can be dragged,
          // while the corner and rotate handles visibly advertise theirs.
          cursor: draggingSelection ? 'move' : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />
      {lassoPoints.length > 0 && (
        <svg
          data-testid="lasso-preview"
          className="pointer-events-none absolute inset-0 z-30"
          width={project.width * zoom}
          height={project.height * zoom}
        >
          <polyline
            points={lassoPoints.map((p) => `${(p.x + 0.5) * zoom},${(p.y + 0.5) * zoom}`).join(' ')}
            fill="none"
            className="stroke-accent"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          {lassoPoints.map((p, i) => (
            <circle
              key={i}
              cx={(p.x + 0.5) * zoom}
              cy={(p.y + 0.5) * zoom}
              r={3}
              className="fill-accent"
            />
          ))}
        </svg>
      )}
      {project.symmetryMode !== 'none' && (
        <div data-testid="symmetry-guides" className="pointer-events-none absolute inset-0 z-20">
          {(project.symmetryMode === 'x' || project.symmetryMode === 'xy') && (
            <div
              className="absolute top-0 bottom-0 w-px bg-accent/70"
              style={{ left: (project.width / 2) * zoom }}
            />
          )}
          {(project.symmetryMode === 'y' || project.symmetryMode === 'xy') && (
            <div
              className="absolute left-0 right-0 h-px bg-accent/70"
              style={{ top: (project.height / 2) * zoom }}
            />
          )}
        </div>
      )}
      {selection && originalSelectionBuffer && (() => {
        // The box is the ORIGINAL selection scaled on each axis and then
        // rotated about its centre — not the rasterised buffer, whose
        // axis-aligned bounding box grows as the shape turns. Drawing the
        // bounding box is what made rotation look like the frame was swelling
        // instead of turning.
        // Rounded the same way rasterizeTransform rounds its output, so at
        // rotation 0 the box matches the buffer's bounding box exactly. Left as
        // a float it sat up to half a sprite pixel off, which let the anchored
        // corner visibly drift while the opposite one was being dragged.
        const boxW = Math.max(1, Math.round(originalSelectionBuffer.width * selectionScaleX))
        const boxH = Math.max(1, Math.round(originalSelectionBuffer.height * selectionScaleY))
        const centerX = selectionOffset.x + selection.width / 2
        const centerY = selectionOffset.y + selection.height / 2
        return (
          // pointer-events-none: the box sits on top of the canvas, so catching
          // events here is what stopped a press inside the selection from ever
          // reaching handlePointerDown — i.e. why the selection could not be
          // dragged. Only the handles opt back in.
          <div
            data-testid="selection-box"
            className="pointer-events-none absolute z-40 border border-accent"
            style={{
              left: (centerX - boxW / 2) * zoom,
              top: (centerY - boxH / 2) * zoom,
              width: boxW * zoom,
              height: boxH * zoom,
              transform: `rotate(${selectionRotation}rad)`,
              transformOrigin: 'center',
            }}
          >
            {[
              { corner: 'nw', x: 0, y: 0, cursor: 'cursor-nwse-resize' },
              { corner: 'ne', x: 1, y: 0, cursor: 'cursor-nesw-resize' },
              { corner: 'se', x: 1, y: 1, cursor: 'cursor-nwse-resize' },
              { corner: 'sw', x: 0, y: 1, cursor: 'cursor-nesw-resize' },
            ].map((h) => (
              <div
                key={h.corner}
                data-testid={`selection-handle-${h.corner}`}
                className={`pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 ${h.cursor} bg-accent`}
                style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%` }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  const canvas = canvasRef.current
                  if (!canvas) return
                  const rect = canvas.getBoundingClientRect()
                  const theta = selectionRotation
                  const baseW = originalSelectionBuffer.width
                  const baseH = originalSelectionBuffer.height
                  // The corner diagonally opposite the one being dragged is the
                  // pivot: it must not move for the whole gesture, so capture
                  // it in canvas coordinates once, up front.
                  const local = rotatePoint((0.5 - h.x) * boxW, (0.5 - h.y) * boxH, theta)
                  const fixedX = centerX + local.x
                  const fixedY = centerY + local.y
                  function onMove(ev: PointerEvent) {
                    const px = (ev.clientX - rect.left) / zoom
                    const py = (ev.clientY - rect.top) / zoom
                    // Undo the rotation so width and height are measured along
                    // the shape's own axes, which is what makes the two
                    // neighbouring corners track the dragged one on x and y.
                    const d = rotatePoint(px - fixedX, py - fixedY, -theta)
                    setSelectionScale(
                      Math.max(MIN_SELECTION_SCALE, snapScale(Math.abs(d.x) / baseW)),
                      Math.max(MIN_SELECTION_SCALE, snapScale(Math.abs(d.y) / baseH)),
                      1 - h.x,
                      1 - h.y
                    )
                  }
                  function onUp() {
                    window.removeEventListener('pointermove', onMove)
                    window.removeEventListener('pointerup', onUp)
                    refineSelection()
                  }
                  window.addEventListener('pointermove', onMove)
                  window.addEventListener('pointerup', onUp)
                }}
              />
            ))}
            <div
              data-testid="selection-handle-rotate"
              className="pointer-events-auto absolute left-1/2 -top-6 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full bg-accent"
              onPointerDown={(e) => {
                e.stopPropagation()
                // Rotate by the angle the pointer sweeps around the selection's
                // centre, so the handle follows the cursor. The old version
                // mapped horizontal travel to radians, which meant the shape
                // spun while the handle stayed put.
                const box = e.currentTarget.parentElement?.getBoundingClientRect()
                if (!box) return
                const cx = box.left + box.width / 2
                const cy = box.top + box.height / 2
                const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx)
                const startRotation = selectionRotation
                function onMove(ev: PointerEvent) {
                  const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx)
                  const next = startRotation + (angle - startAngle)
                  setSelectionRotation(
                    ev.shiftKey ? Math.round(next / ROTATION_SNAP_STEP) * ROTATION_SNAP_STEP : next
                  )
                }
                function onUp() {
                  window.removeEventListener('pointermove', onMove)
                  window.removeEventListener('pointerup', onUp)
                  refineSelection()
                }
                window.addEventListener('pointermove', onMove)
                window.addEventListener('pointerup', onUp)
              }}
            />
          </div>
        )
      })()}
    </div>
  )
}
