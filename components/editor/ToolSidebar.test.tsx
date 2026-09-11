import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolSidebar } from './ToolSidebar'
import { useProjectStore } from '../../lib/store/projectStore'

describe('ToolSidebar', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Tools', 4, 4)
  })

  it('renders a button for every tool', () => {
    render(<ToolSidebar />)
    ;['pencil', 'eraser', 'line', 'rectangle', 'ellipse', 'fill', 'eyedropper', 'move', 'lasso'].forEach((tool) => {
      expect(screen.getByRole('button', { name: new RegExp(tool, 'i') })).toBeTruthy()
    })
  })

  it('clicking a tool button sets it as the active tool', () => {
    render(<ToolSidebar />)
    fireEvent.click(screen.getByRole('button', { name: /fill/i }))
    expect(useProjectStore.getState().activeTool).toBe('fill')
  })

  it('offers a turn-off button only while the lasso is the active tool', () => {
    render(<ToolSidebar />)
    expect(screen.queryByRole('button', { name: /turn off lasso/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^lasso$/i }))

    expect(screen.getByRole('button', { name: /turn off lasso/i })).toBeInTheDocument()
  })

  it('turning off the lasso applies the floating selection and returns to the pencil', () => {
    useProjectStore.getState().paintAt(1, 1, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().setActiveTool('lasso')
    useProjectStore.getState().startLassoSelection([
      { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
    ])
    useProjectStore.getState().moveSelection(1, 0)
    render(<ToolSidebar />)

    fireEvent.click(screen.getByRole('button', { name: /turn off lasso/i }))

    const state = useProjectStore.getState()
    const layerId = state.project.activeLayerId
    expect(state.selection).toBeNull()
    expect(state.activeTool).toBe('pencil')
    // the pixel lands where it was dragged, not back where it started
    expect(state.project.frames[0].layerPixels[layerId][1 * 4 + 2]).toBe('#ff0000')
    expect(state.project.frames[0].layerPixels[layerId][1 * 4 + 1]).toBeNull()
  })

  it('turning off the lasso with nothing selected just switches tool', () => {
    useProjectStore.getState().setActiveTool('lasso')
    render(<ToolSidebar />)
    fireEvent.click(screen.getByRole('button', { name: /turn off lasso/i }))
    expect(useProjectStore.getState().activeTool).toBe('pencil')
  })

  it('shows a filled/outline toggle only for rectangle and ellipse', () => {
    render(<ToolSidebar />)
    expect(screen.queryByRole('button', { name: /filled/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /rectangle/i }))
  })

  it('the filled/outline toggle reports its state and flips it', () => {
    useProjectStore.getState().setActiveTool('rectangle')
    render(<ToolSidebar />)
    const toggle = screen.getByRole('button', { name: /toggle filled/i })
    const before = useProjectStore.getState().shapeFilled
    expect(toggle).toHaveAttribute('aria-pressed', String(before))
    fireEvent.click(toggle)
    expect(useProjectStore.getState().shapeFilled).toBe(!before)
    expect(toggle).toHaveAttribute('aria-pressed', String(!before))
  })
})
