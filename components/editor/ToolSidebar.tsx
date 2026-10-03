'use client'

import {
  Pencil,
  Eraser,
  Slash,
  Square,
  Circle,
  PaintBucket,
  Pipette,
  Move,
  Lasso,
  Check,
  RectangleHorizontal,
} from 'lucide-react'
import { useProjectStore } from '../../lib/store/projectStore'
import type { Tool } from '../../lib/types'

const TOOLS: { id: Tool; label: string; hint: string; icon: typeof Pencil }[] = [
  { id: 'pencil', label: 'Pencil', hint: 'Pencil: draw pixels', icon: Pencil },
  { id: 'eraser', label: 'Eraser', hint: 'Eraser: clear pixels', icon: Eraser },
  { id: 'line', label: 'Line', hint: 'Line: drag to draw a straight line', icon: Slash },
  { id: 'rectangle', label: 'Rectangle', hint: 'Rectangle: drag to draw a rectangle', icon: Square },
  { id: 'ellipse', label: 'Ellipse', hint: 'Ellipse: drag to draw an ellipse', icon: Circle },
  { id: 'fill', label: 'Fill', hint: 'Fill: flood-fill an area with the active colour', icon: PaintBucket },
  { id: 'eyedropper', label: 'Eyedropper', hint: 'Eyedropper: pick a colour from the canvas', icon: Pipette },
  { id: 'move', label: 'Move', hint: 'Move: drag to shift the active layer, or a floating selection', icon: Move },
  { id: 'lasso', label: 'Lasso', hint: 'Lasso: draw around pixels to select them, then move, resize or rotate', icon: Lasso },
]

const SHAPE_TOOLS: Tool[] = ['rectangle', 'ellipse']

export function ToolSidebar() {
  const activeTool = useProjectStore((s) => s.activeTool)
  const setActiveTool = useProjectStore((s) => s.setActiveTool)
  const shapeFilled = useProjectStore((s) => s.shapeFilled)
  const setShapeFilled = useProjectStore((s) => s.setShapeFilled)

  return (
    <div className="flex w-14 flex-col items-center gap-1 border-r border-neutral-700 py-2">
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.id
        const Icon = tool.icon
        return (
          <button
            key={tool.id}
            type="button"
            aria-label={tool.label}
            title={tool.hint}
            aria-pressed={isActive}
            onClick={() => setActiveTool(tool.id)}
            // The offset leaves a gap so the ring still shows around the
            // active tool, whose own background is the same accent colour.
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 ${
              isActive ? 'bg-accent text-on-accent' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={isActive ? 2.25 : 1.75} />
          </button>
        )
      })}
      {activeTool === 'lasso' && (
        // Leaving the lasso for any other tool already applies a floating
        // selection (setActiveTool does it); this puts that on a visible button
        // instead of leaving Enter as the only way to finish.
        <button
          type="button"
          aria-label="Turn off lasso"
          title="Apply the selection and turn off lasso"
          onClick={() => setActiveTool('pencil')}
          className="flex h-9 w-9 items-center justify-center rounded bg-neutral-800 text-neutral-300 transition-colors duration-150 hover:bg-neutral-700 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          <Check className="h-4.5 w-4.5" strokeWidth={1.75} />
        </button>
      )}
      {SHAPE_TOOLS.includes(activeTool) && (
        <button
          type="button"
          aria-label="Toggle filled"
          aria-pressed={shapeFilled}
          title={shapeFilled ? 'Shapes are filled: click to draw outlines' : 'Shapes are outlines: click to fill them'}
          onClick={() => setShapeFilled(!shapeFilled)}
          className="mt-2 flex h-9 w-9 items-center justify-center rounded bg-neutral-800 text-neutral-100 transition-colors duration-150 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          <RectangleHorizontal
            className="h-4.5 w-4.5"
            strokeWidth={1.75}
            fill={shapeFilled ? 'currentColor' : 'none'}
          />
        </button>
      )}
    </div>
  )
}
