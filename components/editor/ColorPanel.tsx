'use client'

import { useRef, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../lib/store/projectStore'
import { hexToRgb, rgbToHex, rgbToHsl, hslToHex } from '../../lib/color'
import type { HSL, RGB } from '../../lib/color'
import { PRESET_PALETTES } from '../../lib/palettes'

export function ColorPanel() {
  const activeColor = useProjectStore((s) => s.activeColor)
  const setActiveColor = useProjectStore((s) => s.setActiveColor)
  const palette = useProjectStore((s) => s.project.palette)
  const addPaletteColor = useProjectStore((s) => s.addPaletteColor)
  const removePaletteColor = useProjectStore((s) => s.removePaletteColor)
  const setPalette = useProjectStore((s) => s.setPalette)

  const rgb = hexToRgb(activeColor)
  const derivedHsl = rgbToHsl(rgb)

  // Hue/Saturation carry no information once a color is fully black, white,
  // or gray (S=0 or L=0/100) — hslToRgb collapses any hue back to the same
  // gray. Deriving H/S fresh from activeColor every render would then snap
  // the Hue/Saturation sliders back to 0 the instant a user drags them from
  // black, since the resulting color is still black. Keep the last
  // meaningful H/S in local state and only resync it from activeColor when
  // the color actually carries saturation, so achromatic colors don't wipe
  // out a hue the user just picked.
  const [prevColor, setPrevColor] = useState(activeColor)
  const [hue, setHue] = useState(derivedHsl.h)
  const [saturation, setSaturation] = useState(derivedHsl.s)
  // Dragging H or S already knows the exact hue/saturation the user picked —
  // resyncing them from the resulting hex (RGB -> HSL round trip) instead
  // reintroduces rounding error, and that error is wildly amplified near
  // L=0/100 where a 1-unit RGB rounding difference can swing S by tens of
  // points. Skip the resync for exactly the render that follows our own
  // updateHsl() call; only genuinely external changes (typed hex, eyedropper,
  // palette swatch, or R/G/B edits) should re-derive H/S from the color.
  const skipNextSyncRef = useRef(false)

  if (activeColor !== prevColor) {
    setPrevColor(activeColor)
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
    } else if (derivedHsl.s > 0) {
      setHue(derivedHsl.h)
      setSaturation(derivedHsl.s)
    }
  }

  const hsl: HSL = { h: hue, s: saturation, l: derivedHsl.l }

  function updateHsl(next: Partial<HSL>) {
    if (next.h !== undefined) setHue(next.h)
    if (next.s !== undefined) setSaturation(next.s)
    skipNextSyncRef.current = true
    setActiveColor(hslToHex({ ...hsl, ...next }))
  }

  function updateRgb(next: Partial<RGB>) {
    setActiveColor(rgbToHex({ ...rgb, ...next }))
  }

  const hueColor = hslToHex({ h: hsl.h, s: 100, l: 50 })
  const satGradient = `linear-gradient(to right, ${hslToHex({ h: hsl.h, s: 0, l: hsl.l })}, ${hslToHex({ h: hsl.h, s: 100, l: hsl.l })})`
  const lightGradient = `linear-gradient(to right, #000000, ${hueColor}, #ffffff)`

  return (
    <div className="flex flex-col gap-3 p-3">
      <h2 className="text-sm font-semibold text-neutral-300">Color</h2>

      <div className="flex flex-col gap-1.5">
        <div
          className="relative h-7 w-full rounded"
          style={{ background: 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)' }}
        >
          <input
            aria-label="Hue"
            type="range"
            min={0}
            max={360}
            value={hsl.h}
            onChange={(e) => updateHsl({ h: Number(e.target.value) })}
            className="gradient-slider absolute inset-0"
          />
        </div>
        <div className="relative h-7 w-full rounded" style={{ background: satGradient }}>
          <input
            aria-label="Saturation"
            type="range"
            min={0}
            max={100}
            value={hsl.s}
            onChange={(e) => updateHsl({ s: Number(e.target.value) })}
            className="gradient-slider absolute inset-0"
          />
        </div>
        <div className="relative h-7 w-full rounded" style={{ background: lightGradient }}>
          <input
            aria-label="Lightness"
            type="range"
            min={0}
            max={100}
            value={hsl.l}
            onChange={(e) => updateHsl({ l: Number(e.target.value) })}
            className="gradient-slider absolute inset-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2">
        <span className="text-sm text-neutral-300">HSL</span>
        <input aria-label="H" type="number" min={0} max={360} className="w-full rounded bg-neutral-800 px-1 py-1 text-center text-sm tabular-nums text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={hsl.h} onChange={(e) => updateHsl({ h: Number(e.target.value) })} />
        <input aria-label="S" type="number" min={0} max={100} className="w-full rounded bg-neutral-800 px-1 py-1 text-center text-sm tabular-nums text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={hsl.s} onChange={(e) => updateHsl({ s: Number(e.target.value) })} />
        <input aria-label="L" type="number" min={0} max={100} className="w-full rounded bg-neutral-800 px-1 py-1 text-center text-sm tabular-nums text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={hsl.l} onChange={(e) => updateHsl({ l: Number(e.target.value) })} />
      </div>

      <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-2">
        <span className="text-sm text-neutral-300">RGB</span>
        <input aria-label="Red" type="number" min={0} max={255} className="w-full rounded bg-neutral-800 px-1 py-1 text-center text-sm tabular-nums text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={rgb.r} onChange={(e) => updateRgb({ r: Number(e.target.value) })} />
        <input aria-label="Green" type="number" min={0} max={255} className="w-full rounded bg-neutral-800 px-1 py-1 text-center text-sm tabular-nums text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={rgb.g} onChange={(e) => updateRgb({ g: Number(e.target.value) })} />
        <input aria-label="Blue" type="number" min={0} max={255} className="w-full rounded bg-neutral-800 px-1 py-1 text-center text-sm tabular-nums text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={rgb.b} onChange={(e) => updateRgb({ b: Number(e.target.value) })} />
      </div>

      <div className="grid grid-cols-[2.5rem_1fr] items-center gap-2">
        <span className="text-sm text-neutral-300">Hex</span>
        <input
          aria-label="Hex"
          className="w-full rounded bg-neutral-800 px-1 py-1 text-center text-sm tabular-nums text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={activeColor}
          onChange={(e) => setActiveColor(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <div
          role="img"
          aria-label="Current color"
          className="h-9 flex-1 rounded border border-neutral-600"
          style={{ backgroundColor: activeColor }}
        />
        <button
          type="button"
          aria-label="Remove color from palette"
          title="Remove the current colour from the palette"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-neutral-700 text-neutral-300 transition-colors duration-150 hover:bg-danger/20 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          onClick={() => removePaletteColor(activeColor)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <div className="mx-1 h-6 w-px shrink-0 bg-neutral-600" />
        <button type="button" aria-label="Add color to palette" title="Add the current colour to the palette" className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-neutral-700 text-neutral-100 transition-colors duration-150 hover:bg-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={() => addPaletteColor(activeColor)}>
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Clear palette" title="Clear the whole palette (Undo brings it back)" className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-neutral-700 text-neutral-300 transition-colors duration-150 hover:bg-danger/20 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger" onClick={() => setPalette([], 'Clear palette')}>
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 rounded border border-neutral-700 bg-neutral-800 p-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {palette.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                title={color}
                // The chosen swatch is marked with a ring, so focus uses an
                // outline instead; two rings would fight over the same colour.
                className={`h-9 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  color === activeColor ? 'ring-2 ring-white' : 'border border-neutral-600'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setActiveColor(color)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1 rounded border border-neutral-700 bg-neutral-800 p-1.5">
          {PRESET_PALETTES.map((preset) => (
            <button
              key={preset.name}
              type="button"
              aria-label={`Load ${preset.name} palette`}
              title={`Load the ${preset.name} palette (replaces yours; Undo brings it back)`}
              className="flex h-6 w-full overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => setPalette(preset.colors, `Load ${preset.name} palette`)}
            >
              {preset.colors.map((color) => (
                <span key={color} className="flex-1" style={{ backgroundColor: color }} />
              ))}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
