'use client'

import { useProjectStore } from '../../lib/store/projectStore'

export function HistoryPanel() {
  const historyLabels = useProjectStore((s) => s.historyLabels)
  const rewindTo = useProjectStore((s) => s.rewindTo)

  const reversed = historyLabels.map((label, index) => ({ label, index })).reverse()

  return (
    <div className="flex flex-col overflow-y-auto">
      <h2 className="px-3 py-2 text-sm font-semibold text-neutral-300">History</h2>
      {reversed.length === 0 ? (
        <p className="px-3 py-1.5 text-sm text-neutral-400">Nothing to undo yet</p>
      ) : (
        <ul>
          {reversed.map(({ label, index }, position) => {
            // the newest entry is the action that produced what is on the canvas now
            const isCurrent = position === 0
            return (
              <li key={index}>
                <button
                  type="button"
                  aria-current={isCurrent ? 'true' : undefined}
                  title={`Return to the state after "${label}"`}
                  className={`w-full px-3 py-1.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                    isCurrent ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-200 hover:bg-neutral-700'
                  }`}
                  onClick={() => rewindTo(index)}
                >
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
