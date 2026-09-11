'use client'

import { useState } from 'react'
import { useProjectStore } from '../../lib/store/projectStore'
import { downloadProjectFile, deserializeProject } from '../../lib/file/projectFile'
import { exportFramePNG, exportSpritesheetPNG, downloadBlob } from '../../lib/file/exportPng'
import type { SymmetryMode } from '../../lib/types'

const SYMMETRY_CYCLE: SymmetryMode[] = ['none', 'x', 'y', 'xy']
const SYMMETRY_LABEL: Record<SymmetryMode, string> = { none: 'Off', x: 'X', y: 'Y', xy: 'XY' }

const BUTTON_CLASS =
  'rounded bg-neutral-700 px-2 py-1 text-sm text-neutral-100 transition-colors duration-150 hover:bg-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 disabled:hover:bg-neutral-700'

interface TopBarProps {
  onNewProject: () => void
}

export function TopBar({ onNewProject }: TopBarProps) {
  const project = useProjectStore((s) => s.project)
  const history = useProjectStore((s) => s.history)
  const future = useProjectStore((s) => s.future)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const renameProject = useProjectStore((s) => s.renameProject)
  const setSymmetryMode = useProjectStore((s) => s.setSymmetryMode)
  const markSaved = useProjectStore((s) => s.markSaved)
  const loadProject = useProjectStore((s) => s.loadProject)
  const [openError, setOpenError] = useState<string | null>(null)

  function cycleSymmetry() {
    const currentIndex = SYMMETRY_CYCLE.indexOf(project.symmetryMode)
    const next = SYMMETRY_CYCLE[(currentIndex + 1) % SYMMETRY_CYCLE.length]
    setSymmetryMode(next)
  }

  function handleSave() {
    downloadProjectFile(project)
    markSaved()
  }

  async function handleOpen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const loaded = deserializeProject(text)
      loadProject(loaded)
      setOpenError(null)
    } catch {
      setOpenError('Invalid project file')
    }
    e.target.value = ''
  }

  async function handleExportPng() {
    const blob = await exportFramePNG(project)
    downloadBlob(blob, `${project.name}.png`)
    markSaved()
  }

  async function handleExportSpritesheet() {
    const blob = await exportSpritesheetPNG(project)
    downloadBlob(blob, `${project.name}-spritesheet.png`)
    markSaved()
  }

  return (
    <div className="flex flex-col border-b border-neutral-700">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" title="Start a new project" onClick={onNewProject} className={BUTTON_CLASS}>
          New
        </button>
        <input
          aria-label="Project name"
          className="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          value={project.name}
          onChange={(e) => renameProject(e.target.value)}
        />
        <button type="button" aria-label="Undo" title="Undo the last action" disabled={history.length === 0} onClick={undo} className={BUTTON_CLASS}>
          Undo
        </button>
        <button type="button" aria-label="Redo" title="Redo the action you undid" disabled={future.length === 0} onClick={redo} className={BUTTON_CLASS}>
          Redo
        </button>
        <button
          type="button"
          aria-label="Symmetry"
          title="Symmetry drawing: click to cycle Off, X, Y, XY"
          onClick={cycleSymmetry} className={BUTTON_CLASS}
        >
          Symmetry: {SYMMETRY_LABEL[project.symmetryMode]}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" title="Save the project as a .json file" onClick={handleSave} className={BUTTON_CLASS}>
            Save
          </button>
          <label title="Open a saved .json project" className={`cursor-pointer ${BUTTON_CLASS}`}>
            Open
            <input type="file" accept=".json" className="hidden" onChange={handleOpen} />
          </label>
          <button
            type="button"
            title="Export the selected frame as a PNG image"
            onClick={handleExportPng}
            className={BUTTON_CLASS}
          >
            Export PNG
          </button>
          <button
            type="button"
            title="Export every frame as one spritesheet PNG"
            onClick={handleExportSpritesheet}
            className={BUTTON_CLASS}
          >
            Export Spritesheet
          </button>
        </div>
      </div>
      {openError && (
        <div className="flex items-center justify-between bg-danger/10 px-3 py-1 text-sm text-danger">
          <span>{openError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            title="Dismiss"
            onClick={() => setOpenError(null)}
            className="rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
