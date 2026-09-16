import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

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

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    setMatchMedia(false)
    document.documentElement.classList.remove('dark')
  })
  afterEach(() => document.documentElement.classList.remove('dark'))

  it('shows a button labelled for the current theme', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /switch to dark/i })).toBeInTheDocument()
  })

  it('clicking toggles the theme and updates the label', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: /switch to dark/i }))
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeInTheDocument()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
