import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NewProjectDialog } from './NewProjectDialog'
import { useProjectStore } from '../../lib/store/projectStore'

describe('NewProjectDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<NewProjectDialog open={false} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('sits on its own stacking layer above the editor content', () => {
    // The canvas and timeline gutters carry positive z-indexes. An overlay left
    // at z-auto paints underneath them and the dialog cannot be clicked.
    render(<NewProjectDialog open={true} onClose={() => {}} />)
    const overlay = screen.getByRole('button', { name: /create/i }).closest('.fixed')
    expect(overlay?.className).toContain('z-50')
  })

  it('is a named modal dialog, with focus on the first field', () => {
    render(<NewProjectDialog open={true} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: /new project/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText(/name/i)).toHaveFocus()
  })

  it('closes on Escape and on a click outside the card', () => {
    const onClose = vi.fn()
    render(<NewProjectDialog open={true} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('keeps Tab inside the dialog', () => {
    render(<NewProjectDialog open={true} onClose={() => {}} />)
    const create = screen.getByRole('button', { name: /create/i })
    create.focus()
    fireEvent.keyDown(create, { key: 'Tab' })
    expect(screen.getByLabelText(/name/i)).toHaveFocus()
    fireEvent.keyDown(screen.getByLabelText(/name/i), { key: 'Tab', shiftKey: true })
    expect(create).toHaveFocus()
  })

  it('creates a project with the entered name/width/height and closes on submit', () => {
    const onClose = vi.fn()
    render(<NewProjectDialog open={true} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Hero' } })
    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '16' } })
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '24' } })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    const { project } = useProjectStore.getState()
    expect(project.name).toBe('Hero')
    expect(project.width).toBe(16)
    expect(project.height).toBe(24)
    expect(onClose).toHaveBeenCalled()
  })
})
