import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from './useTheme'

function setMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('defaults to the OS preference when nothing is stored (dark)', () => {
    setMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('defaults to the OS preference when nothing is stored (light)', () => {
    setMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('a stored preference overrides the OS setting', () => {
    setMatchMedia(false)
    localStorage.setItem('file-search:theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('toggle() flips the theme, applies the class, and persists it', () => {
    setMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => result.current.toggle())

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('file-search:theme')).toBe('dark')
  })

  it('persists across a fresh hook instance (simulating reload)', () => {
    setMatchMedia(false)
    const first = renderHook(() => useTheme())
    act(() => first.result.current.toggle())

    const second = renderHook(() => useTheme())
    expect(second.result.current.theme).toBe('dark')
  })
})
