'use client'

import { useEffect, useRef } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  /** id of the element inside that names the dialog */
  labelledBy: string
  /** Esc and a click on the scrim call this. Omit it for a dialog that forces a choice. */
  onDismiss?: () => void
  /** classes for the dialog card (width, padding, surface) */
  className: string
  children: ReactNode
}

export function Modal({ labelledBy, onDismiss, className, children }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const initial = card.querySelector<HTMLElement>('[data-autofocus]') ?? card.querySelector<HTMLElement>(FOCUSABLE)
    initial?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && onDismiss) {
      e.stopPropagation()
      onDismiss()
      return
    }
    if (e.key !== 'Tab') return
    const items = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  function handleScrimMouseDown(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    // keep focus inside the dialog; a click on the scrim must not drop it to <body>
    e.preventDefault()
    onDismiss?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={handleScrimMouseDown}
      onKeyDown={handleKeyDown}
    >
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={className}>
        {children}
      </div>
    </div>
  )
}
