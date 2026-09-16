import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const directoryOpen = vi.fn()
vi.mock('browser-fs-access', () => ({ directoryOpen: (...args: unknown[]) => directoryOpen(...args) }))

const { FallbackFileList } = await import('./FallbackFileList')

function fakeFile(name: string, webkitRelativePath: string): File {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'webkitRelativePath', { value: webkitRelativePath })
  return file
}

describe('FallbackFileList', () => {
  it('shows a button to pick a folder read-only', () => {
    render(<FallbackFileList />)
    expect(screen.getByRole('button', { name: /select folder/i })).toBeInTheDocument()
  })

  it('lists files after picking a folder', async () => {
    directoryOpen.mockResolvedValueOnce([
      fakeFile('invoice.pdf', 'Docs/invoice.pdf'),
      fakeFile('report.docx', 'Docs/report.docx'),
    ])
    render(<FallbackFileList />)
    await userEvent.click(screen.getByRole('button', { name: /select folder/i }))

    await waitFor(() => expect(screen.getByText('invoice.pdf')).toBeInTheDocument())
    expect(screen.getByText('report.docx')).toBeInTheDocument()
  })

  it('filters the listed files by search text', async () => {
    directoryOpen.mockResolvedValueOnce([
      fakeFile('invoice.pdf', 'Docs/invoice.pdf'),
      fakeFile('report.docx', 'Docs/report.docx'),
    ])
    render(<FallbackFileList />)
    await userEvent.click(screen.getByRole('button', { name: /select folder/i }))
    await waitFor(() => expect(screen.getByText('invoice.pdf')).toBeInTheDocument())

    await userEvent.type(screen.getByRole('searchbox'), 'invoice')

    await waitFor(() => expect(screen.queryByText('report.docx')).not.toBeInTheDocument())
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument()
  })

  it('dismissing the native picker is a no-op, no unhandled rejection', async () => {
    const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    directoryOpen.mockRejectedValueOnce(abortError)
    render(<FallbackFileList />)

    await userEvent.click(screen.getByRole('button', { name: /select folder/i }))

    expect(screen.getByRole('button', { name: /select folder/i })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('shows a scanning indicator while directoryOpen() is pending', async () => {
    let resolveOpen!: (files: File[]) => void
    directoryOpen.mockReturnValueOnce(new Promise((resolve) => (resolveOpen = resolve)))
    render(<FallbackFileList />)

    await userEvent.click(screen.getByRole('button', { name: /select folder/i }))
    expect(await screen.findByText(/scanning/i)).toBeInTheDocument()

    resolveOpen([fakeFile('a.pdf', 'a.pdf')])
    await waitFor(() => expect(screen.queryByText(/scanning/i)).not.toBeInTheDocument())
    expect(screen.getAllByText('a.pdf').length).toBeGreaterThan(0)
  })

  it('pressing / focuses the search box once files are listed', async () => {
    directoryOpen.mockResolvedValueOnce([fakeFile('a.pdf', 'a.pdf')])
    render(<FallbackFileList />)
    await userEvent.click(screen.getByRole('button', { name: /select folder/i }))
    await waitFor(() => expect(screen.getByRole('searchbox')).toBeInTheDocument())

    await userEvent.keyboard('/')

    expect(screen.getByRole('searchbox')).toHaveFocus()
  })
})
