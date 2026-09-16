import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'file-search:theme'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return systemPrefersDark() ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/** Reads/writes the light/dark preference; falls back to OS preference when unset. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = readInitialTheme()
    applyTheme(initial)
    return initial
  })

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, next)
      applyTheme(next)
      return next
    })
  }, [])

  return { theme, toggle }
}
