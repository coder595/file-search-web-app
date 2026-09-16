import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeFakeDeps } from './test/fakeFileSearchDeps'
import App from './App'

describe('App', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__FORCE_FALLBACK__
    delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker
  })

  it('shows the unsupported-browser banner when the File System Access API is unavailable', () => {
    ;(window as unknown as Record<string, unknown>).__FORCE_FALLBACK__ = true
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent(/read-only fallback mode/i)
  })

  it('does not show the banner when the File System Access API is available', () => {
    ;(window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = () => {}
    const { deps } = makeFakeDeps()
    render(<App deps={deps} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders the app heading', () => {
    const { deps } = makeFakeDeps()
    render(<App deps={deps} />)
    expect(screen.getByRole('heading', { name: /file search/i })).toBeInTheDocument()
  })
})
