import { useEffect } from 'react'
import type { RefObject } from 'react'

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Focuses `ref`'s element when `key` is pressed, unless the user is already
 * typing in another input/textarea/select — must not hijack typing in
 * filter fields (plan.md Section 24).
 */
export function useFocusShortcut(key: string, ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key !== key) return
      const active = document.activeElement
      const isTyping = active instanceof HTMLElement && TYPING_TAGS.has(active.tagName) && active !== ref.current
      if (isTyping) return
      e.preventDefault()
      ref.current?.focus()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [key, ref])
}
