import '@testing-library/jest-dom/vitest'
import { ImageData as NodeCanvasImageData } from 'canvas'

if (typeof globalThis.ImageData === 'undefined') {
  // jsdom doesn't provide a global ImageData constructor even with the
  // `canvas` package installed as its canvas backend; polyfill it so
  // code under test can call `new ImageData(...)` like it does in a browser.
  ;(globalThis as unknown as { ImageData: unknown }).ImageData = NodeCanvasImageData
}
