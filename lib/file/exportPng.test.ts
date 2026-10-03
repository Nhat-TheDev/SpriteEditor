import { describe, it, expect } from 'vitest'
import { buildFrameCanvas, buildSpritesheetCanvas } from './exportPng'
import { createEmptyProject } from '../store/projectStore'
import { compositeFrame } from '../canvas/compositing'

describe('buildFrameCanvas', () => {
  it('builds a canvas sized exactly to width/height with smoothing disabled', () => {
    const project = createEmptyProject('Export', 4, 6)
    const pixels = compositeFrame(project.frames[0], project.layers, 4, 6)
    const canvas = buildFrameCanvas(pixels, 4, 6)
    expect(canvas.width).toBe(4)
    expect(canvas.height).toBe(6)
  })
})

describe('buildSpritesheetCanvas', () => {
  it('builds a canvas width*frameCount wide, height tall', () => {
    const project = createEmptyProject('Export', 4, 4)
    project.frames.push({ id: 'f2', layerPixels: { ...project.frames[0].layerPixels } })
    const canvas = buildSpritesheetCanvas(project)
    expect(canvas.width).toBe(4 * 2)
    expect(canvas.height).toBe(4)
  })
})
