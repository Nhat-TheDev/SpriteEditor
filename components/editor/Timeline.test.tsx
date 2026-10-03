import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Timeline } from './Timeline'
import { useProjectStore } from '../../lib/store/projectStore'

describe('Timeline', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Timeline', 4, 4)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders one cell per frame for each layer', () => {
    useProjectStore.getState().addFrame()
    render(<Timeline />)
    expect(screen.getAllByRole('button', { name: /frame \d+ on /i })).toHaveLength(2)
  })

  it('numbers the ruler every fifth frame', () => {
    render(<Timeline />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('gives every layer its own row', () => {
    useProjectStore.getState().addLayer()
    render(<Timeline />)
    expect(screen.getByLabelText('Layer 1 name')).toBeInTheDocument()
    expect(screen.getByLabelText('Layer 2 name')).toBeInTheDocument()
  })

  it('caps the grid at four layer rows and scrolls beyond that', () => {
    for (let i = 0; i < 5; i++) useProjectStore.getState().addLayer() // 6 layers
    render(<Timeline />)
    const scroller = screen.getByTestId('timeline-scroll')
    // ruler (24) + four rows (56 each); a fifth row must not add height
    expect(scroller.style.maxHeight).toBe('248px')
    expect(scroller.className).toContain('overflow-auto')
    expect(screen.getAllByLabelText(/layer \d+ name/i)).toHaveLength(6)
  })

  it('sizes a layer name box to its text rather than stretching it across the column', () => {
    render(<Timeline />)
    const input = screen.getByLabelText('Layer 1 name')
    expect(input.className).toContain('field-sizing-content')
    expect(input.className).not.toContain('flex-1')
  })

  it('clicking a cell selects that frame and that layer at once', () => {
    useProjectStore.getState().addFrame()
    useProjectStore.getState().addLayer() // becomes the active layer
    const firstLayerId = useProjectStore.getState().project.layers[0].id
    render(<Timeline />)

    fireEvent.click(screen.getByRole('button', { name: 'Frame 1 on Layer 1' }))

    const { project } = useProjectStore.getState()
    expect(project.activeFrameIndex).toBe(0)
    expect(project.activeLayerId).toBe(firstLayerId)
  })

  it('clicking a frame number in the ruler switches frame on the current layer', () => {
    useProjectStore.getState().addFrame()
    useProjectStore.getState().addFrame()
    useProjectStore.getState().addLayer() // Layer 2 becomes the active layer
    useProjectStore.getState().setActiveFrame(0)
    const layerId = useProjectStore.getState().project.activeLayerId
    render(<Timeline />)

    fireEvent.click(screen.getByRole('button', { name: 'Select frame 3' }))

    const { project } = useProjectStore.getState()
    expect(project.activeFrameIndex).toBe(2)
    expect(project.activeLayerId).toBe(layerId)
  })

  it('highlights the ruler cell of the selected frame only', () => {
    useProjectStore.getState().addFrame()
    useProjectStore.getState().setActiveFrame(1)
    render(<Timeline />)

    expect(screen.getByRole('button', { name: 'Select frame 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Select frame 1' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('leaves ruler slots with no frame behind them inert', () => {
    render(<Timeline />)
    expect(screen.queryByRole('button', { name: 'Select frame 2' })).toBeNull()
  })

  it('keeps a hidden layer visible in its timeline cells', () => {
    // hiding hides the layer on the canvas only; the cell still previews it
    useProjectStore.getState().paintAt(1, 1, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    const layerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().toggleLayerVisibility(layerId)
    expect(useProjectStore.getState().project.layers[0].visible).toBe(false)

    render(<Timeline />)

    const thumbnail = screen.getByRole('button', { name: 'Frame 1 on Layer 1' }).querySelector('canvas')!
    const alpha = thumbnail.getContext('2d')!.getImageData(1, 1, 1, 1).data[3]
    expect(alpha).toBeGreaterThan(0)
  })

  it('paste buttons stay disabled until a frame has been copied', () => {
    render(<Timeline />)
    expect(screen.getByRole('button', { name: /paste over frame/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /paste as new frame/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /copy frame/i }))

    expect(screen.getByRole('button', { name: /paste over frame/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /paste as new frame/i })).toBeEnabled()
  })

  it('copy then paste over moves the picture onto the selected frame', () => {
    useProjectStore.getState().paintAt(1, 1, '#ff0000')
    useProjectStore.getState().commitStroke('Pencil')
    const layerId = useProjectStore.getState().project.activeLayerId
    useProjectStore.getState().addFrame()
    useProjectStore.getState().setActiveFrame(0)
    render(<Timeline />)

    fireEvent.click(screen.getByRole('button', { name: /copy frame/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Select frame 2' }))
    fireEvent.click(screen.getByRole('button', { name: /paste over frame/i }))

    expect(useProjectStore.getState().project.frames[1].layerPixels[layerId][1 * 4 + 1]).toBe('#ff0000')
  })

  it('paste as new adds a frame', () => {
    render(<Timeline />)
    fireEvent.click(screen.getByRole('button', { name: /copy frame/i }))
    fireEvent.click(screen.getByRole('button', { name: /paste as new frame/i }))
    expect(useProjectStore.getState().project.frames).toHaveLength(2)
  })

  it('clicking add-frame adds a frame', () => {
    render(<Timeline />)
    fireEvent.click(screen.getByRole('button', { name: /add frame/i }))
    expect(useProjectStore.getState().project.frames).toHaveLength(2)
  })

  it('moves the active layer up the stack', () => {
    useProjectStore.getState().addLayer() // Layer 2, active, sits below Layer 1
    render(<Timeline />)

    fireEvent.click(screen.getByRole('button', { name: /move layer up/i }))

    expect(useProjectStore.getState().project.layers[0].name).toBe('Layer 2')
  })

  it('moves the active frame one step left', () => {
    useProjectStore.getState().addFrame()
    const ids = useProjectStore.getState().project.frames.map((f) => f.id)
    useProjectStore.getState().setActiveFrame(1)
    render(<Timeline />)

    fireEvent.click(screen.getByRole('button', { name: /move frame left/i }))

    expect(useProjectStore.getState().project.frames.map((f) => f.id)).toEqual([ids[1], ids[0]])
  })

  it('moves the active frame all the way to the end', () => {
    useProjectStore.getState().addFrame()
    useProjectStore.getState().addFrame()
    const ids = useProjectStore.getState().project.frames.map((f) => f.id)
    useProjectStore.getState().setActiveFrame(0)
    render(<Timeline />)

    fireEvent.click(screen.getByRole('button', { name: /move frame to end/i }))

    expect(useProjectStore.getState().project.frames[2].id).toBe(ids[0])
  })

  it('toggles onion skin', () => {
    render(<Timeline />)
    fireEvent.click(screen.getByRole('button', { name: /onion skin/i }))
    expect(useProjectStore.getState().onionSkin).toBe(true)
  })

  it('changing the FPS select updates the store', () => {
    render(<Timeline />)
    fireEvent.change(screen.getByLabelText(/fps/i), { target: { value: '24' } })
    expect(useProjectStore.getState().project.fps).toBe(24)
  })

  it('play advances activeFrameIndex on an interval and stop halts it', () => {
    vi.useFakeTimers()
    useProjectStore.getState().addFrame()
    useProjectStore.getState().setActiveFrame(0)
    useProjectStore.getState().setFps(10) // 100ms/frame
    render(<Timeline />)
    fireEvent.click(screen.getByRole('button', { name: /^play$/i }))
    vi.advanceTimersByTime(100)
    expect(useProjectStore.getState().project.activeFrameIndex).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }))
    vi.advanceTimersByTime(500)
    expect(useProjectStore.getState().project.activeFrameIndex).toBe(1)
  })
})
