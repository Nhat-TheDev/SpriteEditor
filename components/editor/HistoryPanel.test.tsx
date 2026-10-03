import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoryPanel } from './HistoryPanel'
import { useProjectStore } from '../../lib/store/projectStore'

describe('HistoryPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Hist', 4, 4)
    useProjectStore.getState().paintAt(0, 0, '#111111')
    useProjectStore.getState().commitStroke('Pencil')
    useProjectStore.getState().paintAt(1, 0, '#222222')
    useProjectStore.getState().commitStroke('Lasso')
  })

  it('renders history labels, most recent first', () => {
    render(<HistoryPanel />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Lasso')
    expect(items[1]).toHaveTextContent('Pencil')
  })

  it('marks only the newest entry as the current state', () => {
    render(<HistoryPanel />)
    const [newest, older] = screen.getAllByRole('button')
    expect(newest).toHaveAttribute('aria-current', 'true')
    expect(older).not.toHaveAttribute('aria-current')
  })

  it('says so when there is nothing to undo yet', () => {
    useProjectStore.getState().newProject('Empty', 4, 4)
    render(<HistoryPanel />)
    expect(screen.getByText(/nothing to undo yet/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('clicking an entry rewinds to that point', () => {
    render(<HistoryPanel />)
    fireEvent.click(screen.getByText('Pencil'))
    const { project, history } = useProjectStore.getState()
    const layerId = project.activeLayerId
    expect(project.frames[0].layerPixels[layerId][1]).toBeNull()
    // rewinding to the "Pencil" step leaves that one action still undoable
    expect(history).toHaveLength(1)
  })
})
