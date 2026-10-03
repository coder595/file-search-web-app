import path from 'node:path'
import { expect, test } from '@playwright/test'

// Runs in real Firefox/WebKit (no __FORCE_FALLBACK__): feature detection must pick the fallback.
const FIXTURE = path.resolve(import.meta.dirname, 'fixtures/fallback-folder')

test('real fallback: banner, folder pick, listing and search', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: /read-only/i })).toContainText(/read-only fallback mode/i)

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /select folder \(read-only\)/i }).click()
  await (await chooser).setFiles(FIXTURE)

  const rows = page.getByRole('listbox').getByRole('option')
  await expect(rows).toHaveCount(3)
  await expect(rows.filter({ hasText: 'invoice_2026.pdf' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'todo.txt' })).toHaveCount(1)

  await page.getByRole('searchbox').fill('invoice')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('invoice_2026.pdf')
})
