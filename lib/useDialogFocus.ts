'use client'
import { useEffect, useRef, type KeyboardEvent } from 'react'

export function useDialogFocus(open: boolean, onClose: () => void, busy = false) {
  const ref = useRef<HTMLDivElement>(null)
  const elements = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
  ) ?? []).filter(element => element.getClientRects().length > 0)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const root = ref.current
    // Focus the dialog itself first, so destructive confirmation is never preselected.
    root?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [open])
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!busy) onClose()
    }
    if (event.key !== 'Tab') return
    const items = elements()
    const first = items[0], last = items[items.length - 1]
    if (!first) { event.preventDefault(); ref.current?.focus(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
      event.preventDefault(); first.focus()
    }
  }
  return { ref, onKeyDown, tabIndex: -1 }
}
