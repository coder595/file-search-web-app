import { expect, test, type Page } from '@playwright/test'

// Runs against the production build (vite preview), the only place the CSP meta exists.
// Deliberate independent pin of vite.config.ts's policy: both must change together.
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
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  const workerUrls: string[] = []
  page.on('worker', (w) => workerUrls.push(w.url()))
  // Positive signal that the scan worker actually spawned (bounded by the expect timeout).
  const waitForWorker = () =>
    expect.poll(() => workerUrls.some((u) => u.includes('scan.worker'))).toBe(true)
  const isProbe = (blocked: unknown) => String(blocked).endsWith('/csp-probe')
  const check = async (expectWorker: boolean) => {
    if (expectWorker) await waitForWorker()
    // Violations/late errors are dispatched as tasks; one round-trip flushes any already queued.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)))
    const all = await violationsOf(page)
    // The deliberate connect-src probe is asserted separately in the live test.
    const violations = all.filter((v) => !isProbe(v.blocked))
    const errors = consoleErrors.filter((m) => !m.includes('csp-probe'))
    expect({ violations, consoleErrors: errors }).toEqual({ violations: [], consoleErrors: [] })
    expect(pageErrors).toEqual([])
  }
  return { check, waitForWorker }
}

type Violation = { directive: string; blocked: string }
const violationsOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cspViolations: Violation[] }).__cspViolations)

test('live path: CSP active, worker loads, zero violations', async ({ page }) => {
  const { check, waitForWorker } = await trackViolations(page)
  await page.goto('/')
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', CSP)
  await expect(page.getByRole('button', { name: 'Select Folder' })).toBeVisible()
  await waitForWorker()
  // A blocked worker trips the store's worker.onerror backstop, which renders an alert.
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Negative probe: connect-src 'none' must be enforced at runtime, not just present as a string.
  const outcome = await page.evaluate(() => fetch('/csp-probe').then(() => 'ok', (e) => e.name))
  expect(outcome).toBe('TypeError')
  await expect
    .poll(async () => (await violationsOf(page)).filter((v) => v.directive.startsWith('connect-src')))
    .toHaveLength(1)

  await check(true)
})

test('fallback path: banner shows, zero violations', async ({ page }) => {
  const { check } = await trackViolations(page, true)
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText(/read-only fallback mode/i)
  await check(false)
})
