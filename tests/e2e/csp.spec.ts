import { expect, test, type Page } from '@playwright/test'

// Runs against the production build (vite preview), the only place the CSP meta exists.
const CSP =
  "default-src 'self'; connect-src 'none'; worker-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'"

async function trackViolations(page: Page, forceFallback = false) {
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && /content security policy/i.test(m.text())) consoleErrors.push(m.text())
  })
  await page.addInitScript((fallback) => {
    const w = window as unknown as Record<string, unknown>
    w.__cspViolations = []
    if (fallback) w.__FORCE_FALLBACK__ = true
    document.addEventListener('securitypolicyviolation', (e) => {
      ;(w.__cspViolations as unknown[]).push({ directive: e.violatedDirective, blocked: e.blockedURI })
    })
  }, forceFallback)
  return async () => {
    // Violations fire asynchronously (worker spawn, late styles); give them a moment to surface.
    await page.waitForTimeout(500)
    const violations = await page.evaluate(() => (window as unknown as { __cspViolations: unknown[] }).__cspViolations)
    expect({ violations, consoleErrors }).toEqual({ violations: [], consoleErrors: [] })
  }
}

test('live path: CSP active, worker loads, zero violations', async ({ page }) => {
  const check = await trackViolations(page)
  await page.goto('/')
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', CSP)
  await expect(page.getByRole('button', { name: 'Select Folder' })).toBeVisible()
  // A blocked worker trips the store's worker.onerror backstop, which renders an alert.
  await expect(page.getByRole('alert')).toHaveCount(0)
  await check()
})

test('fallback path: banner shows, zero violations', async ({ page }) => {
  const check = await trackViolations(page, true)
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText(/read-only fallback mode/i)
  await check()
})
