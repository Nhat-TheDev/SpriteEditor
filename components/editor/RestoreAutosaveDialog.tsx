'use client'

import { useId } from 'react'
import { Modal } from './Modal'

interface RestoreAutosaveDialogProps {
  open: boolean
  onRestore: () => void
  onDiscard: () => void
}

export function RestoreAutosaveDialog({ open, onRestore, onDiscard }: RestoreAutosaveDialogProps) {
  const titleId = useId()

  if (!open) return null

  // No onDismiss: Esc or a click outside would have to pick Restore or Start
  // New for the user, and Start New throws the autosave away.
  return (
    <Modal labelledBy={titleId} className="flex w-80 flex-col gap-3 rounded bg-neutral-800 p-4">
        <h2 id={titleId} className="text-sm font-semibold text-neutral-100">Restore unsaved work?</h2>
        <p className="text-sm text-neutral-300">
          We found unsaved work from a previous session — restore it, or start a new project?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1 text-sm text-neutral-300 transition-colors duration-150 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onDiscard}
          >
            Start New
          </button>
          <button
            type="button"
            data-autofocus
            className="rounded bg-accent px-3 py-1 text-sm text-on-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-800"
            onClick={onRestore}
          >
            Restore
          </button>
        </div>
    </Modal>
  )
}
