import { describe, expect, it, vi } from 'vitest'
import { checkPermission, requestPermission } from './permission'

function fakeHandle(overrides: Partial<{ queryPermission: unknown; requestPermission: unknown }> = {}) {
  return {
    queryPermission: vi.fn().mockResolvedValue('granted'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    ...overrides,
  } as unknown as FileSystemDirectoryHandle
}

describe('checkPermission', () => {
  it('calls queryPermission in read mode and returns its result, without prompting', async () => {
    const handle = fakeHandle({ queryPermission: vi.fn().mockResolvedValue('prompt') })
    await expect(checkPermission(handle)).resolves.toBe('prompt')
    expect((handle as unknown as { queryPermission: ReturnType<typeof vi.fn> }).queryPermission).toHaveBeenCalledWith({
      mode: 'read',
    })
  })
})

describe('requestPermission', () => {
  it('calls requestPermission in read mode (only ever from a user-gesture handler) and returns its result', async () => {
    const handle = fakeHandle({ requestPermission: vi.fn().mockResolvedValue('denied') })
    await expect(requestPermission(handle)).resolves.toBe('denied')
    expect(
      (handle as unknown as { requestPermission: ReturnType<typeof vi.fn> }).requestPermission,
    ).toHaveBeenCalledWith({ mode: 'read' })
  })
})
