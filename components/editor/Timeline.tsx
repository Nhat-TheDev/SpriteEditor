'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  ClipboardPaste,
  Contrast,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  FastForward,
  Layers as LayersIcon,
  Pause,
  Play,
  Plus,
  Rewind,
  Trash2,
} from 'lucide-react'
import { useProjectStore } from '../../lib/store/projectStore'
import { compositeFrame, pixelsToImageData } from '../../lib/canvas/compositing'
import type { Frame, Layer } from '../../lib/types'

const FPS_OPTIONS = [1, 2, 4, 6, 8, 10, 12, 15, 20, 24, 30, 60]
// Empty trailing slots so the strip reads as a timeline you can fill rather
// than a short row of buttons.
const MIN_COLUMNS = 30
const CELL_WIDTH = 60
const ROW_HEIGHT = 56
const GUTTER_WIDTH = 300
const RULER_HEIGHT = 24
// Past this many layers the grid scrolls vertically instead of growing the
// panel and squeezing the canvas.
const MAX_VISIBLE_LAYERS = 4

const ICON_BUTTON_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded text-neutral-200 transition-colors duration-150 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const DANGER_BUTTON_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded text-neutral-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger'

function FrameThumbnail({
  frame,
  layerId,
  width,
  height,
}: {
  frame: Frame
  layerId: string
  width: number
  height: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // The eye icon hides a layer on the canvas being drawn on, not in the
    // timeline, so this cell always shows its layer's pixels. compositeFrame
    // skips layers marked invisible, hence a stand-in layer that is visible.
    const pixels = compositeFrame(frame, [{ id: layerId, name: '', visible: true, opacity: 1 }], width, height)
    ctx.imageSmoothingEnabled = false
    ctx.putImageData(pixelsToImageData(pixels, width, height), 0, 0)
    // frame.layerPixels holds the actual pixel data; frame identity alone
    // doesn't change when pixels are edited in place by the store, so depend
    // on this layer's serialized content too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, layerId, width, height, JSON.stringify(frame.layerPixels[layerId])])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      // the same checker as the main canvas, so a frame reads the same here as
      // where it is being drawn
      className="checkerboard h-full w-full"
      style={{ imageRendering: 'pixelated', backgroundSize: '6px 6px' }}
    />
  )
}

function LayerOpacityInput({ layer }: { layer: Layer }) {
  const setLayerOpacity = useProjectStore((s) => s.setLayerOpacity)
  const setActiveLayer = useProjectStore((s) => s.setActiveLayer)
  // Raw text kept locally so the field can be emptied mid-edit; re-syncs from
  // the store whenever the opacity changes from anywhere else.
  const [text, setText] = useState(() => String(Math.round(layer.opacity * 100)))
  const [syncedOpacity, setSyncedOpacity] = useState(layer.opacity)
  if (layer.opacity !== syncedOpacity) {
    setSyncedOpacity(layer.opacity)
    setText(String(Math.round(layer.opacity * 100)))
  }
  return (
    <input
      type="number"
      min={0}
      max={100}
      step={1}
      aria-label={`Opacity of ${layer.name} in percent`}
      title={`Opacity of ${layer.name} (0–100%)`}
      className="w-12 shrink-0 rounded bg-neutral-900 px-1.5 py-0.5 text-right text-xs tabular-nums text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const value = Number(e.target.value)
        if (e.target.value === '' || Number.isNaN(value)) return
        setLayerOpacity(layer.id, Math.min(100, Math.max(0, value)) / 100)
      }}
      onBlur={() => setText(String(Math.round(layer.opacity * 100)))}
      onClick={(e) => e.stopPropagation()}
      onFocus={() => setActiveLayer(layer.id)}
    />
  )
}

export function Timeline() {
  const frames = useProjectStore((s) => s.project.frames)
  const layers = useProjectStore((s) => s.project.layers)
  const width = useProjectStore((s) => s.project.width)
  const height = useProjectStore((s) => s.project.height)
  const activeFrameIndex = useProjectStore((s) => s.project.activeFrameIndex)
  const activeLayerId = useProjectStore((s) => s.project.activeLayerId)
  const fps = useProjectStore((s) => s.project.fps)
  const addFrame = useProjectStore((s) => s.addFrame)
  const removeFrame = useProjectStore((s) => s.removeFrame)
  const reorderFrame = useProjectStore((s) => s.reorderFrame)
  const setActiveFrame = useProjectStore((s) => s.setActiveFrame)
  const copyFrame = useProjectStore((s) => s.copyFrame)
  const pasteFrame = useProjectStore((s) => s.pasteFrame)
  const pasteFrameAsNew = useProjectStore((s) => s.pasteFrameAsNew)
  const hasFrameClipboard = useProjectStore((s) => s.frameClipboard !== null)
  const setFps = useProjectStore((s) => s.setFps)
  const addLayer = useProjectStore((s) => s.addLayer)
  const removeLayer = useProjectStore((s) => s.removeLayer)
  const renameLayer = useProjectStore((s) => s.renameLayer)
  const setActiveLayer = useProjectStore((s) => s.setActiveLayer)
  const toggleLayerVisibility = useProjectStore((s) => s.toggleLayerVisibility)
  const reorderLayer = useProjectStore((s) => s.reorderLayer)
  const onionSkin = useProjectStore((s) => s.onionSkin)
  const toggleOnionSkin = useProjectStore((s) => s.toggleOnionSkin)

  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      const state = useProjectStore.getState()
      const next = (state.project.activeFrameIndex + 1) % state.project.frames.length
      state.setActiveFrame(next)
    }, 1000 / fps)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, fps])

  const activeLayerIndex = layers.findIndex((l) => l.id === activeLayerId)
  const columnCount = Math.max(frames.length, MIN_COLUMNS)
  const lastFrame = frames.length - 1

  function stepFrame(delta: number) {
    setActiveFrame((activeFrameIndex + delta + frames.length) % frames.length)
  }

  return (
    <div className="flex flex-col bg-neutral-900">
      <div className="flex items-center gap-1 border-b border-neutral-700 bg-neutral-800 px-2 py-1.5">
        <button type="button" aria-label="Add layer" title="Add a new layer" className={ICON_BUTTON_CLASS} onClick={addLayer}>
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Move layer up" title="Move the selected layer up"
          className={ICON_BUTTON_CLASS}
          onClick={() => reorderLayer(activeLayerIndex, activeLayerIndex - 1)}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Move layer down" title="Move the selected layer down"
          className={ICON_BUTTON_CLASS}
          onClick={() => reorderLayer(activeLayerIndex, activeLayerIndex + 1)}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Delete layer" title="Delete the selected layer"
          className={DANGER_BUTTON_CLASS}
          onClick={() => removeLayer(activeLayerId)}
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px bg-neutral-600" />

        <select
          aria-label="FPS" title="Playback speed in frames per second"
          className="h-8 rounded bg-neutral-700 px-2 text-sm text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
        >
          {FPS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <span className="ml-2 text-sm text-neutral-300">FPS</span>

        <div className="flex-1" />

        <button
          type="button"
          aria-label="Onion skin" title="Onion skin: show the previous frame faintly behind the drawing"
          aria-pressed={onionSkin}
          className={`${ICON_BUTTON_CLASS} ${onionSkin ? 'bg-accent text-on-accent' : ''}`}
          onClick={toggleOnionSkin}
        >
          <LayersIcon className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Previous frame" title="Go to the previous frame" className={ICON_BUTTON_CLASS} onClick={() => stepFrame(-1)}>
          <Rewind className="h-4 w-4" fill="currentColor" />
        </button>
        {isPlaying ? (
          <button type="button" aria-label="Pause" title="Pause the animation" className={ICON_BUTTON_CLASS} onClick={() => setIsPlaying(false)}>
            <Pause className="h-4 w-4" fill="currentColor" />
          </button>
        ) : (
          <button type="button" aria-label="Play" title="Play the animation" className={ICON_BUTTON_CLASS} onClick={() => setIsPlaying(true)}>
            <Play className="h-4 w-4" fill="currentColor" />
          </button>
        )}
        <button type="button" aria-label="Next frame" title="Go to the next frame" className={ICON_BUTTON_CLASS} onClick={() => stepFrame(1)}>
          <FastForward className="h-4 w-4" fill="currentColor" />
        </button>

        <div className="flex-1" />

        <button type="button" aria-label="Add frame" title="Add a new empty frame" className={ICON_BUTTON_CLASS} onClick={addFrame}>
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Move frame left" title="Move the selected frame left"
          className={ICON_BUTTON_CLASS}
          onClick={() => reorderFrame(activeFrameIndex, Math.max(0, activeFrameIndex - 1))}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Move frame right" title="Move the selected frame right"
          className={ICON_BUTTON_CLASS}
          onClick={() => reorderFrame(activeFrameIndex, Math.min(lastFrame, activeFrameIndex + 1))}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Move frame to start" title="Move the selected frame to the start"
          className={ICON_BUTTON_CLASS}
          onClick={() => reorderFrame(activeFrameIndex, 0)}
        >
          <ArrowLeftToLine className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Move frame to end" title="Move the selected frame to the end"
          className={ICON_BUTTON_CLASS}
          onClick={() => reorderFrame(activeFrameIndex, lastFrame)}
        >
          <ArrowRightToLine className="h-4 w-4" />
        </button>
        <div className="mx-1 h-6 w-px bg-neutral-600" />
        <button type="button" aria-label="Copy frame" title="Copy the selected frame (every layer)" className={ICON_BUTTON_CLASS} onClick={copyFrame}>
          <Copy className="h-4 w-4" />
        </button>
        {/* nothing to paste until a frame has been copied */}
        <button
          type="button"
          aria-label="Paste over frame"
          title={
            hasFrameClipboard ? 'Paste over the selected frame' : 'Paste over the selected frame (copy a frame first)'
          }
          disabled={!hasFrameClipboard}
          className={`${ICON_BUTTON_CLASS} disabled:opacity-40 disabled:hover:bg-transparent`}
          onClick={pasteFrame}
        >
          <ClipboardPaste className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Paste as new frame"
          title={
            hasFrameClipboard
              ? 'Paste as a new frame after the selected one'
              : 'Paste as a new frame after the selected one (copy a frame first)'
          }
          disabled={!hasFrameClipboard}
          className={`${ICON_BUTTON_CLASS} disabled:opacity-40 disabled:hover:bg-transparent`}
          onClick={pasteFrameAsNew}
        >
          <CopyPlus className="h-4 w-4" />
        </button>
        <div className="mx-1 h-6 w-px bg-neutral-600" />
        <button
          type="button"
          aria-label="Delete frame" title="Delete the selected frame"
          className={DANGER_BUTTON_CLASS}
          onClick={() => removeFrame(activeFrameIndex)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div
        data-testid="timeline-scroll"
        className="overflow-auto"
        style={{ maxHeight: RULER_HEIGHT + MAX_VISIBLE_LAYERS * ROW_HEIGHT }}
      >
        <div className="min-w-max">
          {/* sticky top so the frame numbers stay put while the layers scroll */}
          <div
            className="sticky top-0 z-30 flex border-b border-neutral-700 bg-neutral-900"
            style={{ height: RULER_HEIGHT }}
          >
            <div
              className="sticky left-0 z-20 shrink-0 bg-neutral-800"
              style={{ width: GUTTER_WIDTH }}
              aria-hidden="true"
            />
            {Array.from({ length: columnCount }, (_, i) => {
              // number every fifth frame, plus the first, as on a ruler
              const label = i === 0 || (i + 1) % 5 === 0 ? <span className="pr-1">{i + 1}</span> : null
              const cellClass = 'shrink-0 border-l border-neutral-700 text-right text-xs tabular-nums'
              if (i >= frames.length) {
                // an empty slot has no frame to switch to, so it stays inert
                return (
                  <div key={i} className={`${cellClass} text-neutral-400`} style={{ width: CELL_WIDTH }}>
                    {label}
                  </div>
                )
              }
              const isActiveFrame = i === activeFrameIndex
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Select frame ${i + 1}`}
                  title={`Go to frame ${i + 1}`}
                  aria-pressed={isActiveFrame}
                  // Switches frame only: the active layer is left alone, so the
                  // same layer is shown at the new frame.
                  onClick={() => setActiveFrame(i)}
                  className={`${cellClass} cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                    isActiveFrame
                      ? 'bg-neutral-600 text-neutral-100'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                  }`}
                  style={{ width: CELL_WIDTH }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {layers.map((layer, layerIndex) => (
            <div key={layer.id} className="flex">
              <div
                className={`sticky left-0 z-20 flex shrink-0 items-center gap-2 border-b border-neutral-700 px-3 ${
                  layer.id === activeLayerId ? 'bg-neutral-700' : 'bg-neutral-800'
                }`}
                style={{ width: GUTTER_WIDTH, height: ROW_HEIGHT }}
                onClick={() => setActiveLayer(layer.id)}
              >
                <button
                  type="button"
                  aria-label={`Toggle visibility of ${layer.name}`}
                  title={layer.visible ? `Hide ${layer.name} on the canvas` : `Show ${layer.name} on the canvas`}
                  className="rounded p-0.5 text-neutral-300 transition-colors duration-150 hover:bg-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLayerVisibility(layer.id)
                  }}
                >
                  {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <input
                  aria-label={`Layer ${layerIndex + 1} name`}
                  // field-sizing makes the box as wide as the name itself. As a
                  // flex item it can still shrink, so a long name stops at the
                  // edge of the layer column instead of pushing past it; the
                  // min width keeps an emptied name clickable.
                  className="field-sizing-content min-w-[2ch] bg-transparent text-sm font-medium text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={layer.name}
                  onChange={(e) => renameLayer(layer.id, e.target.value)}
                  // the row's own click handler only helps the mouse; focusing
                  // the name is how a keyboard user picks the layer
                  onFocus={() => setActiveLayer(layer.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1" />
                <Contrast
                  className="h-3.5 w-3.5 shrink-0 text-neutral-500"
                  aria-hidden="true"
                />
                <LayerOpacityInput layer={layer} />
                <span className="text-xs text-neutral-500">%</span>
              </div>

              {Array.from({ length: columnCount }, (_, frameIndex) => {
                const frame = frames[frameIndex]
                if (!frame) {
                  return (
                    <div
                      key={frameIndex}
                      className="shrink-0 border-b border-l border-neutral-800 bg-neutral-600/70"
                      style={{ width: CELL_WIDTH, height: ROW_HEIGHT }}
                    />
                  )
                }
                const isActive = frameIndex === activeFrameIndex && layer.id === activeLayerId
                return (
                  <button
                    key={frame.id}
                    type="button"
                    aria-label={`Frame ${frameIndex + 1} on ${layer.name}`}
                    title={`Frame ${frameIndex + 1} on ${layer.name}`}
                    aria-pressed={isActive}
                    // ring-white and inset: the active cell is itself accent
                    // coloured, so an accent ring drawn outside it disappears
                    className={`shrink-0 border-b border-l border-neutral-800 p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${
                      isActive ? 'bg-accent' : 'bg-neutral-600 hover:bg-neutral-500'
                    }`}
                    style={{ width: CELL_WIDTH, height: ROW_HEIGHT }}
                    onClick={() => {
                      setActiveFrame(frameIndex)
                      setActiveLayer(layer.id)
                    }}
                  >
                    <FrameThumbnail frame={frame} layerId={layer.id} width={width} height={height} />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
