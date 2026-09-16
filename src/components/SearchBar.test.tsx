import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FileSearchStoreProvider } from '../store/FileSearchStoreProvider'
import { makeFakeDeps } from '../test/fakeFileSearchDeps'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('debounces typed input into a worker query message', async () => {
    const { deps, worker } = makeFakeDeps()
    render(
      <FileSearchStoreProvider deps={deps}>
        <SearchBar />
      </FileSearchStoreProvider>,
    )

    await userEvent.type(screen.getByRole('searchbox'), 'invoice')

    await waitFor(() =>
      expect(worker.posted.at(-1)).toEqual({
        type: 'query',
        filters: expect.objectContaining({ query: 'invoice' }),
      }),
    )
  })

  it('has a placeholder describing what it searches', () => {
    const { deps } = makeFakeDeps()
    render(
      <FileSearchStoreProvider deps={deps}>
        <SearchBar />
      </FileSearchStoreProvider>,
    )
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', expect.stringMatching(/search/i))
  })

  it('pressing / focuses the search box', async () => {
    const { deps } = makeFakeDeps()
    render(
      <FileSearchStoreProvider deps={deps}>
        <SearchBar />
      </FileSearchStoreProvider>,
    )
    await userEvent.keyboard('/')
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })
})
