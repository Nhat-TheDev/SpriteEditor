'use client'

import { useId, useState } from 'react'
import { useProjectStore } from '../../lib/store/projectStore'
import { Modal } from './Modal'

interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const newProject = useProjectStore((s) => s.newProject)
  const [name, setName] = useState('Untitled')
  const [width, setWidth] = useState('32')
  const [height, setHeight] = useState('32')
  const titleId = useId()

  // Keep the raw digits in state so clearing the field doesn't snap back to
  // "0", and strip leading zeros while typing ("032" -> "32").
  function handleNumberChange(
    value: string,
    setter: (v: string) => void,
  ) {
    const digits = value.replace(/[^0-9]/g, '')
    setter(digits.replace(/^0+(?=\d)/, ''))
  }

  function applyPreset(size: number) {
    setWidth(String(size))
    setHeight(String(size))
  }

  if (!open) return null

  return (
    <Modal labelledBy={titleId} onDismiss={onClose} className="flex w-72 flex-col gap-3 rounded bg-neutral-800 p-4">
        <h2 id={titleId} className="text-sm font-semibold text-neutral-100">New Project</h2>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          Name
          <input
            data-autofocus
            aria-label="Name"
            className="rounded bg-neutral-900 px-2 py-1 text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="flex gap-1" aria-label="Size presets">
          {[16, 32, 64, 128].map((size) => (
            <button
              key={size}
              type="button"
              className="rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-300 transition-colors duration-150 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => applyPreset(size)}
            >
              {size}x{size}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          Width
          <input
            aria-label="Width"
            type="number"
            className="rounded bg-neutral-900 px-2 py-1 text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={width}
            onChange={(e) => handleNumberChange(e.target.value, setWidth)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          Height
          <input
            aria-label="Height"
            type="number"
            className="rounded bg-neutral-900 px-2 py-1 text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={height}
            onChange={(e) => handleNumberChange(e.target.value, setHeight)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1 text-sm text-neutral-300 transition-colors duration-150 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-accent px-3 py-1 text-sm text-on-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-800"
            onClick={() => {
              newProject(name, Number(width) || 32, Number(height) || 32)
              onClose()
            }}
          >
            Create
          </button>
        </div>
    </Modal>
  )
}
