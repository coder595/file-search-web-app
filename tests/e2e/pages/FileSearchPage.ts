import type { Locator, Page } from '@playwright/test'

export class FileSearchPage {
  readonly page: Page
  readonly selectFolderButton: Locator
  readonly resumeAccessButton: Locator
  readonly refreshButton: Locator
  readonly searchBox: Locator
  readonly extensionInput: Locator
  readonly rows: Locator
  readonly listbox: Locator
  readonly toast: Locator

  constructor(page: Page) {
    this.page = page
    this.selectFolderButton = page.getByRole('button', { name: 'Select Folder' })
    this.resumeAccessButton = page.getByRole('button', { name: /resume access/i })
    this.refreshButton = page.getByRole('button', { name: 'Refresh' })
    this.searchBox = page.getByRole('searchbox')
    this.extensionInput = page.getByLabel('Extension')
    this.listbox = page.getByRole('listbox')
    this.rows = this.listbox.getByRole('option')
    this.toast = page.getByRole('status')
  }

  async goto() {
    await this.page.goto('/')
  }

  async selectFolder() {
    await this.selectFolderButton.click()
  }

  async search(text: string) {
    await this.searchBox.fill(text)
  }

  async rowNames() {
    return this.rows.locator('span').first().allTextContents()
  }
}
