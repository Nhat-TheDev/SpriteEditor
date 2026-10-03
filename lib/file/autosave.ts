import type { Project } from '../types'
import { serializeProject, deserializeProject } from './projectFile'

export const AUTOSAVE_KEY = 'spritepaint-autosave'

export function saveAutosave(project: Project): void {
  localStorage.setItem(AUTOSAVE_KEY, serializeProject(project))
}

export function loadAutosave(): Project | null {
  const raw = localStorage.getItem(AUTOSAVE_KEY)
  if (!raw) return null
  try {
    return deserializeProject(raw)
  } catch {
    return null
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY)
}
