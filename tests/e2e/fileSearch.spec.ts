import { expect, test } from '@playwright/test'
import { installMockFileSystem, SAMPLE_TREE } from './fixtures/mockFileSystem'
import { FileSearchPage } from './pages/FileSearchPage'

test.describe('File Search — Chrome/Edge path (mocked File System Access API)', () => {
  test('select folder, scan, search, filter, and copy a path', async ({ page }) => {
    await installMockFileSystem(page, SAMPLE_TREE)
    const app = new FileSearchPage(page)
    await app.goto()

    await app.selectFolder()
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
    await expect(page.getByRole('row')).toHaveCount(4) // 2 top-level files + 1 subfolder + 1 nested file

    await app.search('invoice')
    await expect(page.getByRole('row')).toHaveCount(2)

    await app.extensionInput.fill('pdf')
    await expect(page.getByRole('row')).toHaveCount(2)

    await page.getByRole('row', { name: /invoice_2026_march\.pdf/ }).click()
    await expect(app.toast).toContainText(/copied/i)
  })

  test('zero results shows an explicit empty state, not a blank screen', async ({ page }) => {
    await installMockFileSystem(page, SAMPLE_TREE)
    const app = new FileSearchPage(page)
    await app.goto()
    await app.selectFolder()
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()

    await app.search('zzz-nonexistent')
    await expect(page.getByText('No results.')).toBeVisible()
  })

  test('Refresh is the only action that triggers a full re-scan', async ({ page }) => {
    await installMockFileSystem(page, SAMPLE_TREE)
    const app = new FileSearchPage(page)
    await app.goto()
    await app.selectFolder()
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()

    await app.refreshButton.click()
    await expect(page.getByRole('row')).toHaveCount(4)
  })

  test('reopening the tab restores the cached index instantly, with no re-scan', async ({ page }) => {
    await installMockFileSystem(page, SAMPLE_TREE)
    const app = new FileSearchPage(page)
    await app.goto()
    await app.selectFolder()
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
    await expect(page.getByRole('row')).toHaveCount(4)

    await page.reload()

    // Instant restore: results appear without clicking Select Folder again.
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
    await expect(page.getByRole('row')).toHaveCount(4)
  })

  test('reopening with permission not yet granted shows Resume access, not a broken restore', async ({
    page,
  }) => {
    await installMockFileSystem(page, SAMPLE_TREE, { permission: 'granted' })
    const app = new FileSearchPage(page)
    await app.goto()
    await app.selectFolder()
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()

    await page.addInitScript(() => {
      ;(window as unknown as { __mockPermission: string }).__mockPermission = 'prompt'
    })
    await page.reload()

    await expect(app.resumeAccessButton).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh' })).toHaveCount(0)

    await app.resumeAccessButton.click()
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
    await expect(page.getByRole('row')).toHaveCount(4)
  })

  test('no network request ever fires while scanning and searching', async ({ page }) => {
    await installMockFileSystem(page, SAMPLE_TREE)
    const requests: string[] = []
    page.on('request', (req) => {
      const url = req.url()
      if (!url.startsWith('http://localhost:5173')) requests.push(url)
    })

    const app = new FileSearchPage(page)
    await app.goto()
    await app.selectFolder()
    await expect(page.getByRole('row')).toHaveCount(4)
    await app.search('invoice')

    expect(requests).toEqual([])
  })
})

test.describe('File Search — fallback banner (Firefox/Safari simulation)', () => {
  test('shows the unsupported-browser banner and a read-only Select Folder button', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __FORCE_FALLBACK__: boolean }).__FORCE_FALLBACK__ = true
    })
    await page.goto('/')

    await expect(page.getByRole('status')).toContainText(/read-only fallback mode/i)
    await expect(page.getByRole('button', { name: /select folder \(read-only\)/i })).toBeVisible()
  })
})
