import { describe, it, expect } from 'vitest'
import { compositeFrame } from './compositing'
import type { Frame, Layer } from '../types'

describe('compositeFrame', () => {
  it('layers[0] is topmost and overrides pixels below it', () => {
    const layers: Layer[] = [
      { id: 'top', name: 'Top', visible: true },
      { id: 'bottom', name: 'Bottom', visible: true },
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
      { id: 'top', name: 'Top', visible: false },
      { id: 'bottom', name: 'Bottom', visible: true },
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
    const layers: Layer[] = [{ id: 'a', name: 'A', visible: true }]
    const frame: Frame = { id: 'f1', layerPixels: { a: [null] } }
    expect(compositeFrame(frame, layers, 1, 1)).toEqual([null])
  })
})
