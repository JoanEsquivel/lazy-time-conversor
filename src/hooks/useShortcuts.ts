import { useEffect, type RefObject } from 'react'

/** ⌘K / Ctrl+K focuses (and thereby opens) the From picker. */
export function useShortcuts(fromInputRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        fromInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fromInputRef])
}
