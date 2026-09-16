import { afterEach, describe, expect, it } from 'vitest'
import { isFileSystemAccessSupported } from './browserSupport'

describe('isFileSystemAccessSupported', () => {
  const original = (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker

  afterEach(() => {
    ;(window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker = original
    delete (window as unknown as Record<string, unknown>).__FORCE_FALLBACK__
  })

  it('returns true when window.showDirectoryPicker exists', () => {
    ;(window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = () => {}
    expect(isFileSystemAccessSupported()).toBe(true)
  })

  it('returns false when window.showDirectoryPicker is absent', () => {
    delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker
    expect(isFileSystemAccessSupported()).toBe(false)
  })

  it('returns false when a manual fallback override flag is set, even if supported', () => {
    ;(window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = () => {}
    ;(window as unknown as Record<string, unknown>).__FORCE_FALLBACK__ = true
    expect(isFileSystemAccessSupported()).toBe(false)
  })
})
