import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColorPanel } from './ColorPanel'
import { useProjectStore } from '../../lib/store/projectStore'
import { hslToHex, rgbToHex } from '../../lib/color'
import { PRESET_PALETTES } from '../../lib/palettes'

describe('ColorPanel', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject('Color', 4, 4)
  })

  it('typing a hex value updates activeColor', () => {
    render(<ColorPanel />)
    const hexInput = screen.getByLabelText(/hex/i)
    fireEvent.change(hexInput, { target: { value: '#123abc' } })
    expect(useProjectStore.getState().activeColor).toBe('#123abc')
  })

  it('dragging the Hue slider updates activeColor to the same saturation/lightness at the new hue', () => {
    useProjectStore.getState().setActiveColor('#ff0000') // h=0 s=100 l=50
    render(<ColorPanel />)
    const hueSlider = screen.getByLabelText(/^hue$/i)
    fireEvent.change(hueSlider, { target: { value: '120' } })
    expect(useProjectStore.getState().activeColor).toBe(hslToHex({ h: 120, s: 100, l: 50 }))
  })

  it('dragging the Saturation slider updates activeColor', () => {
    useProjectStore.getState().setActiveColor('#ff0000') // h=0 s=100 l=50
    render(<ColorPanel />)
    const satSlider = screen.getByLabelText(/^saturation$/i)
    fireEvent.change(satSlider, { target: { value: '50' } })
    expect(useProjectStore.getState().activeColor).toBe(hslToHex({ h: 0, s: 50, l: 50 }))
  })

  it('dragging the Lightness slider updates activeColor', () => {
    useProjectStore.getState().setActiveColor('#ff0000') // h=0 s=100 l=50
    render(<ColorPanel />)
    const lightSlider = screen.getByLabelText(/^lightness$/i)
    fireEvent.change(lightSlider, { target: { value: '25' } })
    expect(useProjectStore.getState().activeColor).toBe(hslToHex({ h: 0, s: 100, l: 25 }))
  })

  it('dragging Lightness does not perturb the displayed Saturation value', () => {
    useProjectStore.getState().setActiveColor(hslToHex({ h: 0, s: 50, l: 50 }))
    render(<ColorPanel />)
    const lightSlider = screen.getByLabelText(/^lightness$/i)
    // near the extremes of L, RGB->HSL round-tripping is at its most
    // unstable for S — this is where the regression showed up
    fireEvent.change(lightSlider, { target: { value: '5' } })
    const satInput = screen.getByLabelText(/^s$/i) as HTMLInputElement
    expect(Number(satInput.value)).toBe(50)
  })

  it('editing the Red numeric input updates activeColor', () => {
    useProjectStore.getState().setActiveColor('#000000')
    render(<ColorPanel />)
    const redInput = screen.getByLabelText(/^red$/i)
    fireEvent.change(redInput, { target: { value: '255' } })
    expect(useProjectStore.getState().activeColor).toBe(rgbToHex({ r: 255, g: 0, b: 0 }))
  })

  it('the add button puts the active color into the palette', () => {
    useProjectStore.getState().setActiveColor('#654321')
    render(<ColorPanel />)
    fireEvent.click(screen.getByRole('button', { name: /add color to palette/i }))
    expect(useProjectStore.getState().project.palette).toContain('#654321')
  })

  it('the remove button takes the active color back out of the palette', () => {
    useProjectStore.getState().setActiveColor('#654321')
    useProjectStore.getState().addPaletteColor('#654321')
    render(<ColorPanel />)
    fireEvent.click(screen.getByRole('button', { name: /remove color from palette/i }))
    expect(useProjectStore.getState().project.palette).not.toContain('#654321')
  })

  it('clearing empties the whole palette', () => {
    useProjectStore.getState().addPaletteColor('#111111')
    useProjectStore.getState().addPaletteColor('#222222')
    render(<ColorPanel />)
    fireEvent.click(screen.getByRole('button', { name: /clear palette/i }))
    expect(useProjectStore.getState().project.palette).toEqual([])
  })

  it('Undo brings the palette back after Clear or after loading a preset', () => {
    useProjectStore.getState().addPaletteColor('#111111')
    render(<ColorPanel />)

    fireEvent.click(screen.getByRole('button', { name: /clear palette/i }))
    expect(useProjectStore.getState().project.palette).toEqual([])
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().project.palette).toEqual(['#111111'])

    fireEvent.click(screen.getByRole('button', { name: /load grayscale palette/i }))
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().project.palette).toEqual(['#111111'])
  })

  it('clicking a preset loads it as the project palette', () => {
    render(<ColorPanel />)
    fireEvent.click(screen.getByRole('button', { name: /load grayscale palette/i }))
    const { palette } = useProjectStore.getState().project
    expect(palette.length).toBeGreaterThan(1)
    expect(palette).toEqual(PRESET_PALETTES[0].colors)
  })

  it('clicking a swatch sets activeColor', () => {
    useProjectStore.getState().addPaletteColor('#00ffaa')
    render(<ColorPanel />)
    fireEvent.click(screen.getByRole('button', { name: '#00ffaa' }))
    expect(useProjectStore.getState().activeColor).toBe('#00ffaa')
  })
})
