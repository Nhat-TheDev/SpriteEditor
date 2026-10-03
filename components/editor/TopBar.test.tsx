import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopBar } from './TopBar'
import { useProjectStore } from '../../lib/store/projectStore'

describe('TopBar', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Test', 4, 4)
  })

  it('calls onNewProject when New is clicked', () => {
    const onNewProject = vi.fn()
    render(<TopBar onNewProject={onNewProject} />)
    fireEvent.click(screen.getByRole('button', { name: /^new$/i }))
    expect(onNewProject).toHaveBeenCalled()
  })

  it('undo/redo buttons call store actions', () => {
    useProjectStore.getState().paintAt(0, 0, '#111111')
    useProjectStore.getState().commitStroke('Pencil')
    render(<TopBar onNewProject={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /undo/i }))
    expect(useProjectStore.getState().history).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /redo/i }))
    expect(useProjectStore.getState().history).toHaveLength(1)
  })

  it('cycles symmetry mode through none -> x -> y -> xy -> none', () => {
    render(<TopBar onNewProject={() => {}} />)
    const button = screen.getByRole('button', { name: /symmetry/i })
    expect(button).toHaveTextContent('Symmetry: Off')
    fireEvent.click(button)
    expect(useProjectStore.getState().project.symmetryMode).toBe('x')
    fireEvent.click(button)
    expect(useProjectStore.getState().project.symmetryMode).toBe('y')
    fireEvent.click(button)
    expect(useProjectStore.getState().project.symmetryMode).toBe('xy')
    fireEvent.click(button)
    expect(useProjectStore.getState().project.symmetryMode).toBe('none')
  })

  it('renaming the project name input updates the store', () => {
    render(<TopBar onNewProject={() => {}} />)
    const nameInput = screen.getByLabelText(/project name/i)
    fireEvent.change(nameInput, { target: { value: 'Renamed' } })
    expect(useProjectStore.getState().project.name).toBe('Renamed')
  })
})
