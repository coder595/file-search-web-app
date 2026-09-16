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
})
