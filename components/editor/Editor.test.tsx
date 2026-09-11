import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Editor } from './Editor'
import { useProjectStore, createEmptyProject } from '../../lib/store/projectStore'
import { saveAutosave } from '../../lib/file/autosave'

describe('Editor', () => {
  beforeEach(() => {
    localStorage.clear()
    useProjectStore.getState().newProject('Fresh', 8, 8)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the main panels', () => {
    render(<Editor />)
    expect(screen.getByTestId('sprite-canvas')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^new$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /pencil/i })).toBeTruthy()
  })

  it('gives every toolbar button a tooltip so hovering says what it does', () => {
    // populate the parts that only render once there is something to show
    useProjectStore.getState().addPaletteColor('#336699')
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().addLayer()
    useProjectStore.getState().addFrame()
    useProjectStore.getState().setActiveTool('rectangle') // reveals the filled/outline toggle
    render(<Editor />)

    const missing = screen
      .getAllByRole('button')
      .filter((button) => !button.getAttribute('title')?.trim())
      .map((button) => button.getAttribute('aria-label') ?? button.textContent)

    expect(missing).toEqual([])
  })

  it('shows RestoreAutosaveDialog on mount when an autosave exists, and Restore loads it', () => {
    const saved = createEmptyProject('SavedWork', 6, 6)
    saveAutosave(saved)
    render(<Editor />)
    expect(screen.getByText(/restore unsaved work/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /restore/i }))
    expect(useProjectStore.getState().project.name).toBe('SavedWork')
  })

  it('does not show RestoreAutosaveDialog when no autosave exists', () => {
    render(<Editor />)
    expect(screen.queryByText(/restore unsaved work/i)).toBeNull()
  })

  it('autosaves on a 5-minute interval only when dirty', () => {
    vi.useFakeTimers()
    render(<Editor />)
    expect(localStorage.getItem('spritepaint-autosave')).toBeNull()
    useProjectStore.getState().paintAt(0, 0, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(localStorage.getItem('spritepaint-autosave')).not.toBeNull()
  })
})
