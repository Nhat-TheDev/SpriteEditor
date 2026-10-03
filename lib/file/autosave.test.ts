import { describe, it, expect, beforeEach } from 'vitest'
import { AUTOSAVE_KEY, saveAutosave, loadAutosave, clearAutosave } from './autosave'
import { createEmptyProject } from '../store/projectStore'

describe('autosave', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saveAutosave then loadAutosave round-trips the project', () => {
    const project = createEmptyProject('Auto', 4, 4)
    saveAutosave(project)
    expect(loadAutosave()).toEqual(project)
  })

  it('loadAutosave returns null when nothing is saved', () => {
    expect(loadAutosave()).toBeNull()
  })

  it('loadAutosave returns null on corrupt data instead of throwing', () => {
    localStorage.setItem(AUTOSAVE_KEY, 'not valid json')
    expect(loadAutosave()).toBeNull()
  })

  it('clearAutosave removes the stored project', () => {
    saveAutosave(createEmptyProject('Auto', 4, 4))
    clearAutosave()
    expect(loadAutosave()).toBeNull()
  })
})
