import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RestoreAutosaveDialog } from './RestoreAutosaveDialog'

describe('RestoreAutosaveDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RestoreAutosaveDialog open={false} onRestore={() => {}} onDiscard={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('sits on its own stacking layer above the editor content', () => {
    // The canvas and timeline gutters carry positive z-indexes. An overlay left
    // at z-auto paints underneath them and the dialog cannot be clicked.
    render(<RestoreAutosaveDialog open={true} onRestore={() => {}} onDiscard={() => {}} />)
    const overlay = screen.getByRole('button', { name: /restore/i }).closest('.fixed')
    expect(overlay?.className).toContain('z-50')
  })

  it('is a named modal dialog, with focus on Restore', () => {
    render(<RestoreAutosaveDialog open={true} onRestore={() => {}} onDiscard={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: /restore unsaved work/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: /restore/i })).toHaveFocus()
  })

  it('does not choose for the user on Escape or a click outside the card', () => {
    // Start New discards the autosave, so neither gesture may trigger it
    const onRestore = vi.fn()
    const onDiscard = vi.fn()
    render(<RestoreAutosaveDialog open={true} onRestore={onRestore} onDiscard={onDiscard} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onRestore).not.toHaveBeenCalled()
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it('calls onRestore when Restore is clicked', () => {
    const onRestore = vi.fn()
    render(<RestoreAutosaveDialog open={true} onRestore={onRestore} onDiscard={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /restore/i }))
    expect(onRestore).toHaveBeenCalled()
  })

  it('calls onDiscard when Start New is clicked', () => {
    const onDiscard = vi.fn()
    render(<RestoreAutosaveDialog open={true} onRestore={() => {}} onDiscard={onDiscard} />)
    fireEvent.click(screen.getByRole('button', { name: /start new/i }))
    expect(onDiscard).toHaveBeenCalled()
  })
})
