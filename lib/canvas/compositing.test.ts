import { describe, it, expect } from 'vitest'
import { compositeFrame } from './compositing'
import type { Frame, Layer } from '../types'

describe('compositeFrame', () => {
  it('layers[0] is topmost and overrides pixels below it', () => {
    const layers: Layer[] = [
      { id: 'top', name: 'Top', visible: true, opacity: 1 },
      { id: 'bottom', name: 'Bottom', visible: true, opacity: 1 },
    ]
    const frame: Frame = {
      id: 'f1',
      layerPixels: {
        top: ['#fff', null],
        bottom: ['#000', '#000'],
      },
    }
    const result = compositeFrame(frame, layers, 2, 1)
    expect(result).toEqual(['#fff', '#000'])
  })

  it('skips hidden layers', () => {
    const layers: Layer[] = [
      { id: 'top', name: 'Top', visible: false, opacity: 1 },
      { id: 'bottom', name: 'Bottom', visible: true, opacity: 1 },
    ]
    const frame: Frame = {
      id: 'f1',
      layerPixels: {
        top: ['#fff'],
        bottom: ['#000'],
      },
    }
    expect(compositeFrame(frame, layers, 1, 1)).toEqual(['#000'])
  })

  it('leaves a pixel transparent when no visible layer has color there', () => {
    const layers: Layer[] = [{ id: 'a', name: 'A', visible: true, opacity: 1 }]
    const frame: Frame = { id: 'f1', layerPixels: { a: [null] } }
    expect(compositeFrame(frame, layers, 1, 1)).toEqual([null])
  })

  it('blends a half-opacity top layer with the one below', () => {
    const layers: Layer[] = [
      { id: 'top', name: 'Top', visible: true, opacity: 0.5 },
      { id: 'bottom', name: 'Bottom', visible: true, opacity: 1 },
    ]
    const frame: Frame = {
      id: 'f1',
      layerPixels: {
        top: ['#ffffff'],
        bottom: ['#000000'],
      },
    }
    const [result] = compositeFrame(frame, layers, 1, 1)
    // white at 50% over black ≈ rgb(128,128,128), fully opaque
    expect(result).toBe('#808080')
  })

  it('a fully transparent layer lets the layers below show through', () => {
    const layers: Layer[] = [
      { id: 'top', name: 'Top', visible: true, opacity: 0 },
      { id: 'bottom', name: 'Bottom', visible: true, opacity: 1 },
    ]
    const frame: Frame = {
      id: 'f1',
      layerPixels: { top: ['#ffffff'], bottom: ['#000000'] },
    }
    expect(compositeFrame(frame, layers, 1, 1)).toEqual(['#000000'])
  })

  it('a semi-transparent layer over empty space keeps partial alpha', () => {
    const layers: Layer[] = [{ id: 'a', name: 'A', visible: true, opacity: 0.5 }]
    const frame: Frame = { id: 'f1', layerPixels: { a: ['#ff0000'] } }
    const [result] = compositeFrame(frame, layers, 1, 1)
    expect(result).toBe('#ff000080')
  })
})
