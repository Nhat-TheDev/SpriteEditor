export type Pixel = string | null

export type Tool =
  | 'pencil'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'fill'
  | 'eyedropper'
  | 'move'
  | 'lasso'

export type SymmetryMode = 'none' | 'x' | 'y' | 'xy'

export interface Layer {
  id: string
  name: string
  visible: boolean
}

export interface Frame {
  id: string
  /** key = Layer.id, value = flat pixel array, index = y * width + x */
  layerPixels: Record<string, Pixel[]>
}

export interface Project {
  name: string
  width: number
  height: number
  fps: number
  layers: Layer[]
  frames: Frame[]
  activeFrameIndex: number
  activeLayerId: string
  palette: string[]
  symmetryMode: SymmetryMode
}
