'use client'

import { useEffect, useState } from 'react'
import { useProjectStore } from '../../lib/store/projectStore'
import { saveAutosave, loadAutosave, clearAutosave } from '../../lib/file/autosave'
import { TopBar } from './TopBar'
import { ToolSidebar } from './ToolSidebar'
import { Canvas } from './Canvas'
import { ColorPanel } from './ColorPanel'
import { HistoryPanel } from './HistoryPanel'
import { Timeline } from './Timeline'
import { NewProjectDialog } from './NewProjectDialog'
import { RestoreAutosaveDialog } from './RestoreAutosaveDialog'

const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000

export function Editor() {
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const loadProject = useProjectStore((s) => s.loadProject)

  useEffect(() => {
    // Reads localStorage (an external system) once on mount; can't become a
    // lazy useState initializer because this component is server-rendered
    // first and localStorage isn't available there.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (loadAutosave() !== null) setRestoreOpen(true)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useProjectStore.getState()
      if (state.isDirty) saveAutosave(state.project)
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  function handleRestore() {
    const saved = loadAutosave()
    if (saved) loadProject(saved)
    setRestoreOpen(false)
  }

  function handleDiscardAutosave() {
    clearAutosave()
    setRestoreOpen(false)
    setNewProjectOpen(true)
  }

  return (
    // Desktop-only by design: below 1024px the editor scrolls sideways inside
    // this wrapper instead of clipping the top bar or squeezing the canvas.
    <div className="h-screen overflow-x-auto bg-background text-foreground">
      <div className="flex h-full min-w-[1024px] flex-col">
        <TopBar onNewProject={() => setNewProjectOpen(true)} />
        <div className="flex flex-1 overflow-hidden">
          <ToolSidebar />
          <div className="flex flex-1 items-center justify-center overflow-auto bg-neutral-950">
            <Canvas />
          </div>
          <div className="flex w-64 flex-col overflow-y-auto border-l border-neutral-700">
            <ColorPanel />
            <div className="border-t border-neutral-700">
              <HistoryPanel />
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-700">
          <Timeline />
        </div>
        <NewProjectDialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
        <RestoreAutosaveDialog open={restoreOpen} onRestore={handleRestore} onDiscard={handleDiscardAutosave} />
      </div>
    </div>
  )
}
