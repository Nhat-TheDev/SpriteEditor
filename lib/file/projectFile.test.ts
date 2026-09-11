import { describe, it, expect } from 'vitest'
import { serializeProject, deserializeProject } from './projectFile'
import { createEmptyProject } from '../store/projectStore'

describe('serializeProject / deserializeProject', () => {
  it('round-trips a project through JSON', () => {
    const project = createEmptyProject('RoundTrip', 4, 4)
    const json = serializeProject(project)
    const restored = deserializeProject(json)
    expect(restored).toEqual(project)
  })

  it('throws on invalid JSON', () => {
    expect(() => deserializeProject('not json')).toThrow('Invalid project file')
  })

  it('throws when required fields are missing', () => {
    expect(() => deserializeProject(JSON.stringify({ name: 'x' }))).toThrow('Invalid project file')
  })

  it('throws when width/height are not positive numbers', () => {
    const project = createEmptyProject('Bad', 4, 4)
    const broken = { ...project, width: 0 }
    expect(() => deserializeProject(JSON.stringify(broken))).toThrow('Invalid project file')
  })
})
