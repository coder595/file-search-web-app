const STORAGE_KEY = 'file-search:ignore-patterns'

export const DEFAULT_IGNORE_PATTERNS: string[] = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.venv',
  'venv',
  '__pycache__',
  'target',
  '.cache',
  'coverage',
]

/** Directory names to skip during a scan; falls back to the default list when unset or corrupted. */
export function readStoredIgnorePatterns(): string[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) return DEFAULT_IGNORE_PATTERNS
  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? (parsed as string[]) : DEFAULT_IGNORE_PATTERNS
  } catch {
    return DEFAULT_IGNORE_PATTERNS
  }
}

export function saveIgnorePatterns(patterns: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
}
