import { useEffect } from 'react'
import type { RefObject } from 'react'

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Focuses `ref`'s element when `key` is pressed, unless the user is already
 * typing in any input/textarea/select (including the target itself) — must not hijack typing in
 * filter fields (plan.md Section 24).
 */
export function useFocusShortcut(key: string, ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== key) return
      const active = document.activeElement
      if (active === ref.current) return // already there: let '/' be typed
      if (active instanceof HTMLElement && (TYPING_TAGS.has(active.tagName) || active.isContentEditable)) return
      e.preventDefault()
      ref.current?.focus()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [key, ref])
}
